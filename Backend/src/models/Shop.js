const mongoose = require("mongoose");

const shopSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // shopkeeper (baad mein)
    name: { type: String, required: true, trim: true },
    description: String,
    category: { type: mongoose.Schema.Types.ObjectId, ref: "Category", required: true, index: true },
    location: {
      type: { type: String, enum: ["Point"], default: "Point" },
      coordinates: { type: [Number], required: true }, // [lng, lat]  (ye order zaroori hai)
    },
    address: String,
    phone: String,
    image: String,
    isOpen: { type: Boolean, default: true },
    openingHours: String, // jaise "09:00 - 22:00"
    rating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    deliveryTimeMin: { type: Number, default: 30 },
    minOrder: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "approved", "suspended"], default: "pending" },
  },
  { timestamps: true }
);

shopSchema.index({ location: "2dsphere" });

module.exports = mongoose.model("Shop", shopSchema);
