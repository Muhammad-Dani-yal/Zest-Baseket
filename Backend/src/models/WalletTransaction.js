const mongoose = require("mongoose");

// Ledger: sirf nayi entries judti hain, purani kabhi edit/delete nahi hoti
const walletTxSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["credit", "debit"], required: true },
    amount: { type: Number, required: true, min: 0 },
    reason: { type: String, enum: ["order_payment", "refund", "topup", "cashback", "adjustment"], required: true },
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    balanceAfter: { type: Number, required: true },
    note: String,
  },
  { timestamps: true }
);

module.exports = mongoose.model("WalletTransaction", walletTxSchema);
