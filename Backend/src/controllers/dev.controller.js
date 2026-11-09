// SIRF TESTING KE LIYE (production mein mount nahi hota).
// Shopkeeper aur Rider app ke baghair poora order flow chalane ke liye.
const Order = require("../models/Order");
const SubOrder = require("../models/SubOrder");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { syncOrderStatus, code4, FINAL } = require("../services/order.service");
const { emitOrder } = require("../sockets/emitter");
const TopUp = require("../models/TopUp");
const { confirmTopUp } = require("../services/wallet.service");

async function myOrder(req) {
  const order = await Order.findOne({ _id: req.params.id, user: req.user._id });
  if (!order) throw new ApiError(404, "Order not found", "ORDER_NOT_FOUND");
  if (FINAL.includes(order.status)) throw new ApiError(409, "Order is closed", "ORDER_CLOSED");
  return order;
}

// Apne account ko rider/customer banana
exports.setRole = asyncHandler(async (req, res) => {
  req.user.role = req.body.role;
  await req.user.save();
  res.json({ success: true, role: req.user.role });
});

// Shops ne order accept kar liya
exports.accept = asyncHandler(async (req, res) => {
  const order = await myOrder(req);
  await SubOrder.updateMany({ order: order._id, status: "placed" }, { $set: { status: "accepted" } });
  const subs = await SubOrder.find({ order: order._id });
  await syncOrderStatus(order, subs);
  res.json({ success: true, orderStatus: order.status, shops: subs.map((s) => ({ shopName: s.shopName, status: s.status })) });
});

// Shops ne saman ready kar diya: har shop ka pickup code banta hai (asal mein shop app dikhayegi)
exports.ready = asyncHandler(async (req, res) => {
  const order = await myOrder(req);
  const subs = await SubOrder.find({ order: order._id });
  const codes = [];
  for (const s of subs) {
    if (!["placed", "accepted", "preparing"].includes(s.status)) continue;
    const pickupCode = code4();
    await SubOrder.updateOne({ _id: s._id }, { $set: { status: "ready", pickupCode, readyAt: new Date() } });
    codes.push({ subOrderId: s._id, shopName: s.shopName, pickupCode });
  }
  await syncOrderStatus(order, await SubOrder.find({ order: order._id }));
  res.json({ success: true, orderStatus: order.status, pickupCodes: codes });
});

// Is order ka rider khud ko bana lena
exports.assignMe = asyncHandler(async (req, res) => {
  const order = await myOrder(req);
  order.rider = req.user._id;
  await order.save();
  emitOrder(order, "rider:assigned", { orderId: String(order._id), rider: { id: req.user._id, name: req.user.name, phone: req.user.phone } });
  res.json({ success: true, rider: req.user._id });
});

// Payment provider ke webhook ki jagah (testing): top-up ko "paid" mark karke wallet credit
exports.confirmTopUp = asyncHandler(async (req, res) => {
  const t = await TopUp.findOne({ _id: req.params.id, user: req.user._id });
  if (!t) throw new ApiError(404, "Top-up not found", "TOPUP_NOT_FOUND");
  const r = await confirmTopUp(t._id);
  res.json({ success: true, already: r.already, status: r.topUp.status, balance: r.balance });
});
