const User = require("../models/User");
const asyncHandler = require("../utils/asyncHandler");
const chat = require("../services/chat.service");
const tracking = require("../services/tracking.service");

// 21: Chat history (customer ya assigned rider)
exports.history = asyncHandler(async (req, res) => {
  const { order } = await chat.loadOrderFor(req.params.id, req.user);
  res.json({ success: true, messages: await chat.history(order, req.query.before, req.query.limit) });
});

// REST se message bhejna (socket na chale to fallback)
exports.send = asyncHandler(async (req, res) => {
  const { order, role } = await chat.loadOrderFor(req.params.id, req.user);
  res.status(201).json({ success: true, message: await chat.sendMessage(order, role, req.user, req.body.text) });
});

exports.read = asyncHandler(async (req, res) => {
  const { order, role } = await chat.loadOrderFor(req.params.id, req.user);
  res.json({ success: true, marked: await chat.markRead(order, role, req.user) });
});

// 14 / 21: Customer ke liye tracking ki halat (screen khulte hi pehli baar)
exports.tracking = asyncHandler(async (req, res) => {
  const { order } = await chat.loadOrderFor(req.params.id, req.user);
  const rider = order.rider ? await User.findById(order.rider).select("name phone") : null;
  const location = tracking.getLocation(order);
  res.json({
    success: true,
    orderNo: order.orderNo,
    status: order.status,
    rider: rider && { id: rider._id, name: rider.name, phone: rider.phone },
    customer: order.address?.location && { lat: order.address.location.coordinates[1], lng: order.address.location.coordinates[0] },
    location,
    etaMin: location?.etaMin ?? null,
    distanceToCustomerKm: location?.distanceToCustomerKm ?? null,
  });
});

// Rider ki location REST se (socket ka fallback, aur testing ke liye)
exports.riderLocation = asyncHandler(async (req, res) => {
  const { order } = await chat.loadOrderFor(req.params.id, req.user);
  const payload = await tracking.updateRiderLocation(order, req.user, req.body);
  res.json({ success: true, location: payload });
});
