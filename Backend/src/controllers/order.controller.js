const crypto = require("crypto");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const SubOrder = require("../models/SubOrder");
const Product = require("../models/Product");
const Cart = require("../models/Cart");
const User = require("../models/User");
const WalletTransaction = require("../models/WalletTransaction");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { evaluateCheckout } = require("../services/checkout.service");

const newOrderNo = () => `ZB-${Date.now().toString(36).toUpperCase()}${crypto.randomInt(100, 999)}`;

const subOrderDTO = (s) => ({
  id: s._id,
  shopId: s.shop,
  shopName: s.shopName,
  status: s.status,
  subtotal: s.subtotal,
  items: s.items.map((i) => ({ productId: i.product, name: i.name, unit: i.unit, image: i.image, price: i.price, qty: i.qty, lineTotal: i.lineTotal })),
});

const orderDTO = (o, subs) => ({
  id: o._id,
  orderNo: o.orderNo,
  status: o.status,
  paymentMethod: o.paymentMethod,
  paymentStatus: o.paymentStatus,
  itemsTotal: o.itemsTotal,
  deliveryFee: o.deliveryFee,
  feeBreakdown: o.feeBreakdown,
  total: o.total,
  note: o.note,
  address: o.address && {
    label: o.address.label,
    line1: o.address.line1,
    city: o.address.city,
    phone: o.address.phone,
    lat: o.address.location?.coordinates?.[1],
    lng: o.address.location?.coordinates?.[0],
  },
  shops: subs.map(subOrderDTO),
  statusHistory: o.statusHistory,
  placedAt: o.createdAt,
});

async function loadOwnOrder(id, userId) {
  const order = await Order.findOne({ _id: id, user: userId });
  if (!order) throw new ApiError(404, "Order not found", "ORDER_NOT_FOUND");
  const subs = await SubOrder.find({ order: order._id });
  return { order, subs };
}

// 11: Checkout screen, poora breakdown (order nahi banta)
exports.quote = asyncHandler(async (req, res) => {
  const c = await evaluateCheckout(req.user._id, req.body.addressId);
  res.json({
    success: true,
    canCheckout: c.problems.length === 0,
    problems: c.problems,
    cart: c.view,
    address: c.address && {
      id: c.address._id,
      label: c.address.label,
      line1: c.address.line1,
      city: c.address.city,
      lat: c.address.location.coordinates[1],
      lng: c.address.location.coordinates[0],
    },
    delivery: c.fee && { route: c.fee.route, ...c.fee.breakdown, deliveryFee: c.fee.deliveryFee },
    totals: c.totals,
    wallet: c.wallet,
    paymentMethods: ["cod", "wallet"], // "online" Phase 6 mein
  });
});

// 11 -> 12: Order banana
exports.create = asyncHandler(async (req, res) => {
  const { addressId, paymentMethod, note } = req.body;
  const userId = req.user._id;
  const idemKey = (req.headers["idempotency-key"] || "").toString().slice(0, 80) || undefined;

  if (paymentMethod === "online")
    throw new ApiError(400, "Online payment is not available yet. Use cash on delivery or wallet", "ONLINE_NOT_AVAILABLE");

  // Wahi request dobara aaye (double tap / network retry) to wahi order wapas
  if (idemKey) {
    const dup = await Order.findOne({ user: userId, idempotencyKey: idemKey });
    if (dup) {
      const subs = await SubOrder.find({ order: dup._id });
      return res.status(200).json({ success: true, duplicate: true, order: orderDTO(dup, subs) });
    }
  }

  const c = await evaluateCheckout(userId, addressId);
  if (c.problems.length) throw new ApiError(422, c.problems[0].message, "CHECKOUT_PROBLEMS", c.problems);
  if (paymentMethod === "wallet" && !c.wallet.enough)
    throw new ApiError(402, "Not enough wallet balance", "INSUFFICIENT_WALLET", { balance: c.wallet.balance, required: c.totals.total });

  const orderId = new mongoose.Types.ObjectId();
  const subDocs = c.view.groups.map((g) => ({
    _id: new mongoose.Types.ObjectId(),
    order: orderId,
    shop: g.shop.id,
    shopName: g.shop.name,
    subtotal: g.subtotal,
    prepTimeMin: g.shop.deliveryTimeMin,
    items: g.items.map((i) => ({ product: i.productId, name: i.name, unit: i.unit, image: i.image, price: i.price, qty: i.qty, lineTotal: i.lineTotal })),
  }));

  const orderDoc = {
    _id: orderId,
    orderNo: newOrderNo(),
    user: userId,
    subOrders: subDocs.map((s) => s._id),
    address: {
      label: c.address.label,
      line1: c.address.line1,
      city: c.address.city,
      phone: c.address.phone || req.user.phone,
      location: c.address.location,
    },
    itemsTotal: c.totals.itemsTotal,
    deliveryFee: c.totals.deliveryFee,
    feeBreakdown: c.fee.breakdown,
    total: c.totals.total,
    paymentMethod,
    paymentStatus: paymentMethod === "wallet" ? "paid" : "pending",
    status: "placed",
    statusHistory: [{ status: "placed", at: new Date() }],
    note,
    deliveryOtp: String(crypto.randomInt(0, 10000)).padStart(4, "0"),
    idempotencyKey: idemKey,
  };

  // Sab kuch ek transaction mein: stock, wallet, order, cart. Beech mein fail ho to sab wapas.
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const g of c.view.groups) {
        for (const i of g.items) {
          const r = await Product.updateOne(
            { _id: i.productId, isAvailable: true, stock: { $gte: i.qty } },
            { $inc: { stock: -i.qty } },
            { session }
          );
          if (!r.modifiedCount) throw new ApiError(409, `${i.name} just went out of stock`, "STOCK_CHANGED");
        }
      }
      if (paymentMethod === "wallet") {
        const u = await User.findOneAndUpdate(
          { _id: userId, walletBalance: { $gte: c.totals.total } },
          { $inc: { walletBalance: -c.totals.total } },
          { new: true, session }
        );
        if (!u) throw new ApiError(402, "Not enough wallet balance", "INSUFFICIENT_WALLET");
        await WalletTransaction.create(
          [{ user: userId, type: "debit", amount: c.totals.total, reason: "order_payment", order: orderId, balanceAfter: u.walletBalance }],
          { session }
        );
      }
      await Order.create([orderDoc], { session });
      await SubOrder.insertMany(subDocs, { session });
      await Cart.updateOne({ user: userId }, { $set: { items: [] } }, { session });
    });
  } catch (e) {
    if (e.code === 11000 && idemKey) {
      const dup = await Order.findOne({ user: userId, idempotencyKey: idemKey });
      if (dup) return res.status(200).json({ success: true, duplicate: true, order: orderDTO(dup, await SubOrder.find({ order: dup._id })) });
    }
    throw e;
  } finally {
    session.endSession();
  }

  const { order, subs } = await loadOwnOrder(orderId, userId);
  res.status(201).json({ success: true, order: orderDTO(order, subs) });
});

// 12: Order confirmation / detail
exports.getOrder = asyncHandler(async (req, res) => {
  const { order, subs } = await loadOwnOrder(req.params.id, req.user._id);
  res.json({ success: true, order: orderDTO(order, subs) });
});

// 13: Digital receipt
exports.receipt = asyncHandler(async (req, res) => {
  const { order, subs } = await loadOwnOrder(req.params.id, req.user._id);
  const o = orderDTO(order, subs);
  res.json({
    success: true,
    receipt: {
      receiptNo: o.orderNo,
      date: o.placedAt,
      customer: { name: req.user.name, phone: req.user.phone },
      deliveryAddress: o.address,
      shops: o.shops.map((s) => ({ shopName: s.shopName, items: s.items, subtotal: s.subtotal })),
      itemsTotal: o.itemsTotal,
      delivery: {
        distanceKm: o.feeBreakdown?.distanceKm,
        baseFee: o.feeBreakdown?.baseFee,
        distanceFee: o.feeBreakdown?.distanceFee,
        extraShopsFee: o.feeBreakdown?.extraShopsFee,
        freeDeliveryApplied: o.feeBreakdown?.freeDeliveryApplied,
        deliveryFee: o.deliveryFee,
      },
      total: o.total,
      payment: { method: o.paymentMethod, status: o.paymentStatus },
      currency: "PKR",
    },
  });
});

exports.orderDTO = orderDTO;
exports.loadOwnOrder = loadOwnOrder;
