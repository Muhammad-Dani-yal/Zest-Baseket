const bcrypt = require("bcryptjs");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const otp = require("../services/otp.service");
const tokens = require("../services/token.service");

const device = (req) => (req.headers["user-agent"] || "").slice(0, 120);
const session = async (user, req) => ({ user: user.toSafeJSON(), ...(await tokens.issueTokens(user, device(req))) });

// 02: Sign up -> OTP bhejta hai (account unverified rehta hai)
exports.signup = asyncHandler(async (req, res) => {
  const { name, phone, email, password } = req.body;
  let user = await User.findOne({ phone }).select("+passwordHash");
  if (user?.isPhoneVerified) throw new ApiError(409, "This number is already registered", "PHONE_EXISTS");

  if (email && (await User.exists({ email, ...(user ? { _id: { $ne: user._id } } : {}) })))
    throw new ApiError(409, "This email is already registered", "EMAIL_EXISTS");

  const passwordHash = await bcrypt.hash(password, 12);
  if (user) Object.assign(user, { name, email, passwordHash }); // unverified purana account update
  else user = new User({ name, phone, email, passwordHash });
  await user.save();

  await otp.sendOtp(phone, "signup");
  res.status(201).json({ success: true, message: "OTP sent", phone });
});

// 03: OTP resend (account hai ya nahi, ye zahir nahi karte)
exports.sendOtp = asyncHandler(async (req, res) => {
  const { phone, purpose } = req.body;
  const user = await User.findOne({ phone });
  if (user && (purpose === "login" || !user.isPhoneVerified)) await otp.sendOtp(phone, purpose);
  res.json({ success: true, message: "If the number is eligible, an OTP was sent" });
});

// 03: OTP verify -> tokens
exports.verifyOtp = asyncHandler(async (req, res) => {
  const { phone, code, purpose } = req.body;
  await otp.verifyOtp(phone, purpose, code);
  const user = await User.findOne({ phone });
  if (!user) throw new ApiError(404, "Account not found", "NO_USER");
  if (!user.isPhoneVerified) {
    user.isPhoneVerified = true;
    await user.save();
  }
  res.json({ success: true, ...(await session(user, req)) });
});

// 02: Login
exports.login = asyncHandler(async (req, res) => {
  const { phone, password } = req.body;
  const user = await User.findOne({ phone }).select("+passwordHash");
  const ok = user && (await bcrypt.compare(password, user.passwordHash));
  if (!ok) throw new ApiError(401, "Incorrect number or password", "BAD_CREDENTIALS");
  if (user.status !== "active") throw new ApiError(403, "Account blocked", "BLOCKED");

  if (!user.isPhoneVerified) {
    await otp.sendOtp(phone, "signup").catch(() => {}); // cooldown ho to ignore
    throw new ApiError(403, "Verify your phone number first", "PHONE_NOT_VERIFIED");
  }
  res.json({ success: true, ...(await session(user, req)) });
});

// 01/22: Session restore
exports.refresh = asyncHandler(async (req, res) => {
  const r = await tokens.rotate(req.body.refreshToken, User);
  res.json({ success: true, user: r.user.toSafeJSON(), accessToken: r.accessToken, refreshToken: r.refreshToken });
});

exports.me = (req, res) => res.json({ success: true, user: req.user.toSafeJSON() });

exports.logout = asyncHandler(async (req, res) => {
  await tokens.revoke(req.body.refreshToken);
  res.json({ success: true });
});

// Forgot password step 1
exports.forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ phone: req.body.phone });
  if (user && user.status === "active") {
    await otp.sendOtp(user.phone, "reset").catch((e) => {
      if (e.code !== "OTP_COOLDOWN") throw e;
    });
  }
  res.json({ success: true, message: "If this number is registered, an OTP was sent" });
});

// step 2: OTP verify -> short-lived reset token
exports.verifyResetOtp = asyncHandler(async (req, res) => {
  const { phone, code } = req.body;
  await otp.verifyOtp(phone, "reset", code);
  const user = await User.findOne({ phone });
  if (!user) throw new ApiError(400, "Incorrect OTP", "OTP_INVALID");
  res.json({ success: true, resetToken: tokens.signReset(user) });
});

// step 3: naya password
exports.resetPassword = asyncHandler(async (req, res) => {
  const { resetToken, newPassword } = req.body;
  const payload = tokens.verifyReset(resetToken);
  const user = await User.findById(payload.sub).select("+passwordHash");
  if (!user) throw new ApiError(400, "Reset session expired", "RESET_INVALID");
  user.passwordHash = await bcrypt.hash(newPassword, 12);
  await user.save();
  await tokens.revokeAllForUser(user._id); // sab devices se logout
  res.json({ success: true, message: "Password updated. Please login" });
});
