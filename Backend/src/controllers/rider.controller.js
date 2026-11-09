const Order = require("../models/Order");
const SubOrder = require("../models/SubOrder");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { syncOrderStatus, safeEqual, FINAL } = require("../services/order.service");
const { emitOrder } = require("../sockets/emitter");
const tracking = require("../services/tracking.service");

const MAX_OTP_ATTEMPTS = 5;

async function myOrder(id, riderId, select = "") {
  const order = await Order.findOne({ _id: id, rider: riderId }).select(select);
  if (!order) throw new ApiError(404, "Order not found for this rider", "ORDER_NOT_FOUND");
  if (FINAL.includes(order.status)) throw new ApiError(409, "Order is already closed", "ORDER_CLOSED");
  return order;
}

// 15: Rider shop se saman uthata hai, shop ka pickup code daal kar
exports.pickup = asyncHandler(async (req, res) => {
  const order = await myOrder(req.params.id, req.user._id);
  const sub = await SubOrder.findOne({ _id: req.params.subId, order: order._id }).select("+pickupCode");
  if (!sub) throw new ApiError(404, "Shop order not found", "SUBORDER_NOT_FOUND");
  if (sub.status === "picked_up") throw new ApiError(409, "Already picked up", "ALREADY_PICKED_UP");
  if (sub.status !== "ready") throw new ApiError(409, "This shop has not marked the order ready yet", "NOT_READY");
  if (!safeEqual(sub.pickupCode, req.body.code)) throw new ApiError(400, "Incorrect pickup code", "BAD_PICKUP_CODE");

  sub.status = "picked_up";
  sub.pickedUpAt = new Date();
  await sub.save();
  const subs = await SubOrder.find({ order: order._id });
  await syncOrderStatus(order, subs);
  const active = subs.filter((s) => !["cancelled", "rejected"].includes(s.status));
  emitOrder(order, "pickup:verified", {
    orderId: String(order._id),
    subOrderId: String(sub._id),
    shopName: sub.shopName,
    pickedUp: active.filter((s) => s.status === "picked_up").length,
    totalShops: active.length,
  });
  res.json({ success: true, orderStatus: order.status, shops: subs.map((s) => ({ shopName: s.shopName, status: s.status })) });
});

// 16: Customer ka delivery OTP daal kar order "delivered" karna
exports.deliver = asyncHandler(async (req, res) => {
  const order = await myOrder(req.params.id, req.user._id, "+deliveryOtp");
  if (order.status !== "out_for_delivery") throw new ApiError(409, "Pick up from all shops first", "NOT_OUT_FOR_DELIVERY");
  if (order.deliveryOtpAttempts >= MAX_OTP_ATTEMPTS) throw new ApiError(429, "Too many wrong codes. Contact support", "OTP_LOCKED");

  if (!safeEqual(order.deliveryOtp, req.body.otp)) {
    order.deliveryOtpAttempts += 1;
    await order.save();
    const left = MAX_OTP_ATTEMPTS - order.deliveryOtpAttempts;
    throw new ApiError(400, `Incorrect code. ${left} attempt(s) left`, "BAD_DELIVERY_OTP");
  }
  order.status = "delivered";
  order.deliveredAt = new Date();
  order.statusHistory.push({ status: "delivered", at: order.deliveredAt });
  if (order.paymentMethod === "cod") order.paymentStatus = "paid"; // cash mil gaya
  await order.save();
  tracking.forget(order._id);
  emitOrder(order, "order:update", { orderId: String(order._id), orderNo: order.orderNo, status: "delivered", at: order.deliveredAt.toISOString() });
  res.json({ success: true, orderNo: order.orderNo, status: order.status, paymentStatus: order.paymentStatus });
});
