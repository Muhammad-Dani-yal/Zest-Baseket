const mongoose = require("mongoose");

// Cart mein sirf product + qty. Price hamesha Product se live aati hai (purani price nahi chalti).
const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    items: [
      {
        _id: false,
        product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
        qty: { type: Number, required: true, min: 1 },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Cart", cartSchema);
