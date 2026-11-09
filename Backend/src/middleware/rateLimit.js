const rateLimit = require("express-rate-limit");

const make = (windowMin, max, message) =>
  rateLimit({
    windowMs: windowMin * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, code: "RATE_LIMITED", message },
  });

module.exports = {
  authLimiter: make(15, 30, "Too many attempts. Try again later"),
  otpLimiter: make(60, 10, "Too many OTP requests. Try again in an hour"),
};
