const mongoose = require("mongoose");
const Order = require("../models/Order");
const SubOrder = require("../models/SubOrder");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const pricing = require("../config/pricing");
const { loadCart, buildView } = require("../services/cart.service");
const { refundWalletPayment } = require("../services/order.service");
const { orderDTO, loadOwnOrder } = require("./order.controller");
const { emitOrder } = require("../sockets/emitter");

const ACTIVE = ["placed", "preparing", "ready_for_pickup", "out_for_delivery"];
const PAST = ["delivered", "cancelled"];

// 17: My Orders
exports.list = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.query;
  const filter = { user: req.user._id };
  if (status === "active") filter.status = { $in: ACTIVE };
  else if (status === "past") filter.status = { $in: PAST };
  else if (status) filter.status = status;

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  const subs = await SubOrder.find({ order: { $in: orders.map((o) => o._id) } });
  const byOrder = {};
  for (const s of subs) (byOrder[String(s.order)] ||= []).push(s);

  res.json({
    success: true,
    orders: orders.map((o) => {
      const ss = byOrder[String(o._id)] || [];
      const items = ss.flatMap((s) => s.items);
      return {
        id: o._id,
        orderNo: o.orderNo,
        status: o.status,
        total: o.total,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        itemCount: items.reduce((n, i) => n + i.qty, 0),
        shops: ss.map((s) => s.shopName),
        thumbnails: items.map((i) => i.image).filter(Boolean).slice(0, 3),
        placedAt: o.createdAt,
      };
    }),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
});

// Cancel: sirf jab tak koi shop ne order accept na kiya ho
exports.cancel = asyncHandler(async (req, res) => {
  const { order, subs } = await loadOwnOrder(req.params.id, req.user._id);
  if (order.status !== "placed" || subs.some((s) => s.status !== "placed"))
    throw new ApiError(409, "This order can no longer be cancelled because a shop has started preparing it", "CANNOT_CANCEL");

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const r = await SubOrder.updateMany({ order: order._id, status: "placed" }, { $set: { status: "cancelled" } }, { session });
      if (r.modifiedCount !== subs.length) throw new ApiError(409, "A shop just accepted this order, it can't be cancelled", "CANNOT_CANCEL");

      for (const s of subs)
        for (const i of s.items) await Product.updateOne({ _id: i.product }, { $inc: { stock: i.qty } }, { session }); // stock wapas

      const updated = await Order.findOneAndUpdate(
        { _id: order._id, status: "placed" },
        {
          $set: { status: "cancelled", cancelledAt: new Date(), cancelReason: (req.body.reason || "").slice(0, 200) || undefined },
          $push: { statusHistory: { status: "cancelled", at: new Date() } },
        },
        { new: true, session }
      );
      if (!updated) throw new ApiError(409, "Order status changed, try again", "CANNOT_CANCEL");
      await refundWalletPayment(updated, session);
    });
  } finally {
    session.endSession();
  }
  const fresh = await loadOwnOrder(req.params.id, req.user._id);
  emitOrder(fresh.order, "order:update", { orderId: String(fresh.order._id), orderNo: fresh.order.orderNo, status: "cancelled", at: new Date().toISOString() });
  res.json({ success: true, order: orderDTO(fresh.order, fresh.subs) });
});

// Reorder: purane order ka saman dobara cart mein (jo available ho)
exports.reorder = asyncHandler(async (req, res) => {
  const { subs } = await loadOwnOrder(req.params.id, req.user._id);
  const cart = (await loadCart(req.user._id)) || new Cart({ user: req.user._id, items: [] });
  const shopIds = new Set(cart.items.map((i) => String(i.product?.shop?._id)).filter(Boolean));
  const added = [];
  const skipped = [];

  for (const s of subs) {
    for (const i of s.items) {
      const p = await Product.findById(i.product).populate("shop", "status");
      if (!p || p.shop?.status !== "approved") { skipped.push({ name: i.name, reason: "No longer sold" }); continue; }
      if (!p.isAvailable || p.stock <= 0) { skipped.push({ name: i.name, reason: "Out of stock" }); continue; }
      if (!shopIds.has(String(p.shop._id)) && shopIds.size >= pricing.maxShopsPerOrder) {
        skipped.push({ name: i.name, reason: "Too many shops in cart" });
        continue;
      }
      shopIds.add(String(p.shop._id));
      const existing = cart.items.find((c) => String(c.product?._id || c.product) === String(p._id));
      const limit = Math.min(p.stock, pricing.maxQtyPerItem);
      const qty = Math.min((existing?.qty || 0) + i.qty, limit);
      if (existing) existing.qty = qty;
      else cart.items.push({ product: p._id, qty });
      added.push({ name: i.name, qty: Math.min(i.qty, limit), reducedFromOriginal: qty - (existing?.qty || 0) < i.qty });
    }
  }
  if (added.length) await cart.save();
  const view = buildView(await loadCart(req.user._id));
  res.json({ success: true, added, skipped, cart: view });
});

// 16: Delivery OTP customer ko dikhana (customer rider ko batata hai)
exports.deliveryOtp = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id }).select("+deliveryOtp");
  if (!order) throw new ApiError(404, "Order not found", "ORDER_NOT_FOUND");
  if (!ACTIVE.includes(order.status)) throw new ApiError(409, "This order is already closed", "ORDER_CLOSED");
  res.json({ success: true, orderNo: order.orderNo, otp: order.deliveryOtp, message: "Ye code sirf delivery ke waqt rider ko batayen" });
});

// 15: Rider pickup verification ka status (customer ke liye)
exports.pickups = asyncHandler(async (req, res) => {
  const { order, subs } = await loadOwnOrder(req.params.id, req.user._id);
  const rider = order.rider ? await User.findById(order.rider).select("name phone") : null;
  const active = subs.filter((s) => !["cancelled", "rejected"].includes(s.status));
  res.json({
    success: true,
    orderStatus: order.status,
    rider: rider && { id: rider._id, name: rider.name, phone: rider.phone },
    shops: subs.map((s) => ({ subOrderId: s._id, shopName: s.shopName, status: s.status, readyAt: s.readyAt, pickedUpAt: s.pickedUpAt })),
    pickedUp: active.filter((s) => s.status === "picked_up").length,
    totalShops: active.length,
    allPickedUp: active.length > 0 && active.every((s) => s.status === "picked_up"),
  });
});
