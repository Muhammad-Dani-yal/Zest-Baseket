const bcrypt = require("bcryptjs");
const User = require("../models/User");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Wishlist = require("../models/Wishlist");
const Address = require("../models/Address");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const tokens = require("../services/token.service");

const ACTIVE_ORDER = ["placed", "preparing", "ready_for_pickup", "out_for_delivery"];
const withPassword = (id) => User.findById(id).select("+passwordHash");

// 18: Profile dekhna
exports.getMe = (req, res) => res.json({ success: true, user: req.user.toSafeJSON() });

// 18: Naam / email badalna (phone badalne ke liye OTP chahiye, wo alag feature hai)
exports.updateMe = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  const user = req.user;
  if (name !== undefined) user.name = name;
  if (email !== undefined) {
    if (email && (await User.exists({ email, _id: { $ne: user._id } })))
      throw new ApiError(409, "This email is already registered", "EMAIL_EXISTS");
    user.email = email || undefined;
  }
  await user.save();
  res.json({ success: true, user: user.toSafeJSON() });
});

// 18: Password badalna. Baaqi saare devices logout, ye device login rehta hai.
exports.changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const user = await withPassword(req.user._id);
  if (!(await bcrypt.compare(currentPassword, user.passwordHash)))
    throw new ApiError(400, "Current password is incorrect", "BAD_PASSWORD");
  if (currentPassword === newPassword) throw new ApiError(400, "New password must be different", "SAME_PASSWORD");

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  await tokens.revokeAllForUser(user._id);
  const session = await tokens.issueTokens(user, (req.headers["user-agent"] || "").slice(0, 120));
  res.json({ success: true, message: "Password updated", ...session });
});

// Push notification token (app khulne par bhejti hai)
exports.setPushToken = asyncHandler(async (req, res) => {
  req.user.pushToken = req.body.token || undefined;
  await req.user.save();
  res.json({ success: true });
});

// Saare devices se logout
exports.logoutAll = asyncHandler(async (req, res) => {
  await tokens.revokeAllForUser(req.user._id);
  res.json({ success: true });
});

// Account delete: personal data hat jata hai, orders ka record hisaab ke liye rehta hai
exports.deleteMe = asyncHandler(async (req, res) => {
  const user = await withPassword(req.user._id);
  if (!(await bcrypt.compare(req.body.password, user.passwordHash)))
    throw new ApiError(400, "Password is incorrect", "BAD_PASSWORD");
  if (await Order.exists({ user: user._id, status: { $in: ACTIVE_ORDER } }))
    throw new ApiError(409, "You have an order in progress. Delete your account after it is delivered", "ACTIVE_ORDER");
  if (user.walletBalance > 0)
    throw new ApiError(409, `Your wallet still has Rs. ${user.walletBalance}. Use it or contact support first`, "WALLET_NOT_EMPTY");

  await tokens.revokeAllForUser(user._id);
  await Promise.all([
    Cart.deleteOne({ user: user._id }),
    Wishlist.deleteOne({ user: user._id }),
    Address.deleteMany({ user: user._id }),
  ]);
  user.status = "deleted";
  user.name = "Deleted user";
  user.phone = `deleted-${user._id}`; // number dobara signup ke liye free ho jata hai
  user.email = undefined;
  user.avatar = undefined;
  user.pushToken = undefined;
  user.isPhoneVerified = false;
  await user.save();
  res.json({ success: true, message: "Account deleted" });
});
