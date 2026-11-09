const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema(
  {
    orderNo: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    subOrders: [{ type: mongoose.Schema.Types.ObjectId, ref: "SubOrder" }],
    address: {
      label: String,
      line1: String,
      city: String,
      phone: String,
      location: { type: { type: String, enum: ["Point"] }, coordinates: [Number] },
    },
    itemsTotal: { type: Number, required: true },
    deliveryFee: { type: Number, required: true },
    feeBreakdown: {
      distanceKm: Number,
      baseFee: Number,
      distanceFee: Number,
      extraShopsFee: Number,
      originalFee: Number,
      freeDeliveryApplied: Boolean,
    },
    total: { type: Number, required: true },
    paymentMethod: { type: String, enum: ["cod", "wallet", "online"], required: true },
    paymentStatus: { type: String, enum: ["pending", "paid", "refunded"], default: "pending" },
    status: {
      type: String,
      enum: ["placed", "preparing", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled"],
      default: "placed",
      index: true,
    },
    statusHistory: [{ _id: false, status: String, at: { type: Date, default: Date.now } }],
    note: String,
    deliveryOtp: { type: String, select: false }, // customer rider ko batata hai (Phase 4)
    rider: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deliveryOtpAttempts: { type: Number, default: 0 },
    riderLocation: { lat: Number, lng: Number, heading: Number, at: Date }, // aakhri known location (har 20 sec mein save)
    deliveredAt: Date,
    cancelledAt: Date,
    cancelReason: String,
    idempotencyKey: String,
  },
  { timestamps: true }
);

// Ek hi request do baar chali to dusra order nahi banega
orderSchema.index(
  { user: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

module.exports = mongoose.model("Order", orderSchema);
