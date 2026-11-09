const { z } = require("zod");
const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const pricing = require("../config/pricing");
const { haversineKm, round1 } = require("../utils/geo");
const { emitOrder } = require("../sockets/emitter");

const TRACKABLE = ["preparing", "ready_for_pickup", "out_for_delivery"];
const AVG_SPEED_KMH = 20;

const schema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).optional(),
});

const lastLoc = new Map(); // orderId -> aakhri location (memory mein, tez)
const lastAt = new Map();
const lastPersist = new Map();

async function updateRiderLocation(order, user, body) {
  if (!order.rider || String(order.rider) !== String(user._id)) throw new ApiError(403, "This is not your order", "NOT_YOUR_ORDER");
  if (!TRACKABLE.includes(order.status)) throw new ApiError(409, "Tracking is not active for this order", "TRACKING_INACTIVE");
  const r = schema.safeParse(body);
  if (!r.success) throw new ApiError(400, "Invalid location", "VALIDATION_ERROR");
  const { lat, lng, heading } = r.data;

  const key = String(order._id);
  const now = Date.now();
  if (now - (lastAt.get(key) || 0) < 1000) throw new ApiError(429, "Location updates are too fast (max 1 per second)", "TOO_FAST");
  lastAt.set(key, now);

  const dest = order.address?.location?.coordinates;
  const km = dest ? haversineKm(lat, lng, dest[1], dest[0]) : null;
  const etaMin =
    order.status === "out_for_delivery" && km != null
      ? Math.max(1, Math.round(((km * pricing.roadFactor) / AVG_SPEED_KMH) * 60))
      : null;

  const payload = {
    orderId: key,
    lat,
    lng,
    heading: heading ?? null,
    at: new Date(now).toISOString(),
    distanceToCustomerKm: km != null ? round1(km) : null,
    etaMin,
  };
  lastLoc.set(key, payload);

  if (now - (lastPersist.get(key) || 0) > 20000) {
    lastPersist.set(key, now); // database mein har 20 second baad hi, har update par nahi
    Order.updateOne({ _id: order._id }, { $set: { riderLocation: { lat, lng, heading, at: new Date(now) } } }).catch(() => {});
  }
  emitOrder(order, "rider:location", payload);
  return payload;
}

function getLocation(order) {
  const key = String(order._id);
  if (lastLoc.has(key)) return lastLoc.get(key);
  const l = order.riderLocation;
  return l && l.lat != null ? { orderId: key, lat: l.lat, lng: l.lng, heading: l.heading ?? null, at: l.at } : null;
}

function forget(orderId) {
  const key = String(orderId);
  lastLoc.delete(key);
  lastAt.delete(key);
  lastPersist.delete(key);
}

module.exports = { updateRiderLocation, getLocation, forget, TRACKABLE };
