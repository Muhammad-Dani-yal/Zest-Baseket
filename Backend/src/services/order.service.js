const crypto = require("crypto");
const User = require("../models/User");
const Order = require("../models/Order");
const WalletTransaction = require("../models/WalletTransaction");
const { emitOrder } = require("../sockets/emitter");

const DEAD = ["cancelled", "rejected"];
const FINAL = ["delivered", "cancelled"];

// Sub-orders ke status se parent order ka status nikalta hai
function deriveStatus(subs) {
  const active = subs.filter((s) => !DEAD.includes(s.status));
  if (!active.length) return "cancelled";
  if (active.every((s) => s.status === "picked_up")) return "out_for_delivery";
  if (active.every((s) => ["ready", "picked_up"].includes(s.status))) return "ready_for_pickup";
  if (active.some((s) => ["accepted", "preparing", "ready", "picked_up"].includes(s.status))) return "preparing";
  return "placed";
}

async function syncOrderStatus(order, subs) {
  if (FINAL.includes(order.status)) return;
  const next = deriveStatus(subs);
  if (next === order.status) return;
  order.status = next;
  order.statusHistory.push({ status: next, at: new Date() });
  await order.save();
  emitOrder(order, "order:update", { orderId: String(order._id), orderNo: order.orderNo, status: next, at: new Date().toISOString() });
}

// Wallet se diya gaya paisa wapas (cancel par). COD mein kuch nahi, kyunke paisa liya hi nahi gaya.
async function refundWalletPayment(order, session) {
  if (order.paymentMethod !== "wallet" || order.paymentStatus !== "paid") return;
  const u = await User.findOneAndUpdate({ _id: order.user }, { $inc: { walletBalance: order.total } }, { new: true, session });
  await WalletTransaction.create(
    [{ user: order.user, type: "credit", amount: order.total, reason: "refund", order: order._id, balanceAfter: u.walletBalance }],
    { session }
  );
  await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: "refunded" } }, { session });
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a || ""));
  const y = Buffer.from(String(b || ""));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

const code4 = () => String(crypto.randomInt(0, 10000)).padStart(4, "0");

module.exports = { deriveStatus, syncOrderStatus, refundWalletPayment, safeEqual, code4, DEAD, FINAL };
