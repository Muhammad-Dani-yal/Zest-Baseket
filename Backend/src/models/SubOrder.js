const mongoose = require("mongoose");

// Order ka wo hissa jo ek shop ka hai
const subOrderSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, index: true },
    shop: { type: mongoose.Schema.Types.ObjectId, ref: "Shop", required: true, index: true },
    shopName: String,
    items: [
      {
        _id: false,
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
        name: String,
        unit: String,
        image: String,
        price: Number, // order ke waqt ki price (snapshot)
        qty: Number,
        lineTotal: Number,
      },
    ],
    subtotal: { type: Number, required: true },
    status: {
      type: String,
      enum: ["placed", "accepted", "preparing", "ready", "picked_up", "rejected", "cancelled"],
      default: "placed",
    },
    prepTimeMin: Number,
    pickupCode: { type: String, select: false }, // shop jab "ready" kare tab banta hai; rider ko shop se milta hai
    readyAt: Date,
    pickedUpAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model("SubOrder", subOrderSchema);
