const mongoose = require("mongoose");
const { z } = require("zod");
const Order = require("../models/Order");
const Message = require("../models/Message");
const ApiError = require("../utils/ApiError");
const { emitOrder } = require("../sockets/emitter");

const CHAT_STATUSES = ["placed", "preparing", "ready_for_pickup", "out_for_delivery"];
const textSchema = z.string().trim().min(1, "Message is empty").max(500, "Message is too long");

const hits = new Map(); // userId -> aakhri 1 minute ki messages ka waqt
function rateLimit(userId) {
  const now = Date.now();
  const list = (hits.get(userId) || []).filter((t) => now - t < 60000);
  if (list.length >= 20) throw new ApiError(429, "You are sending messages too fast", "RATE_LIMITED");
  list.push(now);
  hits.set(userId, list);
}

// Is user ka is order mein kya role hai? (customer ya assigned rider)
function roleIn(order, user) {
  const isCustomer = String(order.user) === String(user._id);
  const isRider = order.rider && String(order.rider) === String(user._id);
  if (isCustomer && isRider) return user.role === "rider" ? "rider" : "customer"; // testing: ek hi account dono ho to
  return isCustomer ? "customer" : isRider ? "rider" : null;
}

async function loadOrderFor(orderId, user) {
  if (!mongoose.isValidObjectId(orderId)) throw new ApiError(400, "Invalid order id", "INVALID_ID");
  const order = await Order.findById(orderId);
  const role = order && roleIn(order, user);
  if (!role) throw new ApiError(404, "Order not found", "ORDER_NOT_FOUND");
  return { order, role };
}

const dto = (m) => ({
  id: m._id,
  orderId: m.order,
  senderId: m.sender,
  senderRole: m.senderRole,
  text: m.text,
  createdAt: m.createdAt,
  readAt: m.readAt || null,
});

async function sendMessage(order, role, user, rawText) {
  const t = textSchema.safeParse(rawText);
  if (!t.success) throw new ApiError(400, t.error.issues[0].message, "VALIDATION_ERROR");
  if (!CHAT_STATUSES.includes(order.status)) throw new ApiError(409, "Chat is closed for this order", "CHAT_CLOSED");
  if (!order.rider) throw new ApiError(409, "A rider has not been assigned yet", "NO_RIDER");
  rateLimit(String(user._id));

  const m = await Message.create({ order: order._id, sender: user._id, senderRole: role, text: t.data });
  const message = dto(m);
  emitOrder(order, "chat:message", message);
  return message;
}

async function history(order, before, limit) {
  const filter = { order: order._id };
  if (before) filter.createdAt = { $lt: before };
  const list = await Message.find(filter).sort({ createdAt: -1 }).limit(limit);
  return list.reverse().map(dto);
}

async function markRead(order, role, user) {
  const r = await Message.updateMany({ order: order._id, sender: { $ne: user._id }, readAt: null }, { $set: { readAt: new Date() } });
  emitOrder(order, "chat:read", { orderId: String(order._id), readerRole: role, at: new Date().toISOString() });
  return r.modifiedCount || 0;
}

module.exports = { loadOrderFor, roleIn, sendMessage, history, markRead };
