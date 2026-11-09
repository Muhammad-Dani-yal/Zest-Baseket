const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, unique: true, index: true },
    email: { type: String, lowercase: true, trim: true, unique: true, sparse: true },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["customer", "shopkeeper", "rider", "employee", "admin"], default: "customer" },
    isPhoneVerified: { type: Boolean, default: false },
    avatar: String,
    walletBalance: { type: Number, default: 0 },
    pushToken: String,
    status: { type: String, enum: ["active", "blocked", "deleted"], default: "active" },
  },
  { timestamps: true }
);

userSchema.methods.toSafeJSON = function () {
  return {
    id: this._id,
    name: this.name,
    phone: this.phone,
    email: this.email,
    role: this.role,
    isPhoneVerified: this.isPhoneVerified,
    avatar: this.avatar,
    walletBalance: this.walletBalance,
  };
};

module.exports = mongoose.model("User", userSchema);
