const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderRole: { type: String, enum: ["customer", "rider"], required: true },
    text: { type: String, required: true, trim: true, maxlength: 500 },
    readAt: Date,
  },
  { timestamps: true }
);

messageSchema.index({ order: 1, createdAt: -1 });

module.exports = mongoose.model("Message", messageSchema);
