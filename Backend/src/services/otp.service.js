const crypto = require("crypto");
const Otp = require("../models/Otp");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const { sendSms } = require("./sms.service");

const hash = (phone, purpose, code) =>
  crypto.createHmac("sha256", env.otpSecret).update(`${phone}:${purpose}:${code}`).digest("hex");

async function sendOtp(phone, purpose) {
  const last = await Otp.findOne({ phone, purpose }).sort({ createdAt: -1 });
  if (last && Date.now() - last.createdAt.getTime() < env.otpCooldownSec * 1000) {
    const wait = Math.ceil((env.otpCooldownSec * 1000 - (Date.now() - last.createdAt.getTime())) / 1000);
    throw new ApiError(429, `Please wait ${wait}s before requesting another OTP`, "OTP_COOLDOWN");
  }
  const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
  await Otp.deleteMany({ phone, purpose });
  await Otp.create({
    phone,
    purpose,
    codeHash: hash(phone, purpose, code),
    expiresAt: new Date(Date.now() + env.otpTtlMinutes * 60 * 1000),
  });
  await sendSms(phone, `Your ZestBasket code is ${code}. It expires in ${env.otpTtlMinutes} minutes. Do not share it.`);
}

async function verifyOtp(phone, purpose, code) {
  const otp = await Otp.findOne({ phone, purpose, usedAt: null }).sort({ createdAt: -1 });
  if (!otp || otp.expiresAt < new Date()) throw new ApiError(400, "OTP expired or not found", "OTP_INVALID");
  if (otp.attempts >= env.otpMaxAttempts) throw new ApiError(429, "Too many wrong attempts. Request a new OTP", "OTP_LOCKED");

  const expected = Buffer.from(otp.codeHash, "hex");
  const given = Buffer.from(hash(phone, purpose, code), "hex");
  if (!crypto.timingSafeEqual(expected, given)) {
    otp.attempts += 1;
    await otp.save();
    throw new ApiError(400, "Incorrect OTP", "OTP_INVALID");
  }
  otp.usedAt = new Date();
  await otp.save();
}

module.exports = { sendOtp, verifyOtp };
