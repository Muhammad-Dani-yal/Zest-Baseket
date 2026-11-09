const mongoose = require("mongoose");

// Wallet top-up ki request. Paisa tab hi wallet mein aata hai jab payment provider confirm kare.
const topUpSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    provider: { type: String, enum: ["mock", "jazzcash", "easypaisa", "card"], required: true },
    providerRef: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "paid", "failed"], default: "pending", index: true },
    paidAt: Date,
    idempotencyKey: String,
  },
  { timestamps: true }
);

topUpSchema.index(
  { user: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: "string" } } }
);

module.exports = mongoose.model("TopUp", topUpSchema);
