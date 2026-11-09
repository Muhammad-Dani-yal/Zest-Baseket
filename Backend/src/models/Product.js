const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: String,
    price: { type: Number, required: true, min: 0 }, // PKR
    unit: String, // "1 kg", "dozen"
    image: String,
    section: { type: String, default: "General" }, // shop ke andar ka section
    stock: { type: Number, default: 0, min: 0 },
    isAvailable: { type: Boolean, default: true },
    popularity: { type: Number, default: 0 },
  },
  { timestamps: true }
);

productSchema.index({ shop: 1, section: 1 });

module.exports = mongoose.model("Product", productSchema);
