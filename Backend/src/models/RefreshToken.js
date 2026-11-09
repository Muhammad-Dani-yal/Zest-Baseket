const mongoose = require("mongoose");

const refreshSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    family: { type: String, required: true, index: true },
    device: String,
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
  },
  { timestamps: true }
);

refreshSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("RefreshToken", refreshSchema);
