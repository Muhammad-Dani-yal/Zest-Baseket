require("dotenv").config();

const required = ["MONGO_URI", "JWT_ACCESS_SECRET", "JWT_RESET_SECRET", "OTP_HMAC_SECRET"];
for (const k of required) {
  if (!process.env[k]) throw new Error(`Missing env variable: ${k}`);
}

module.exports = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  mongoUri: process.env.MONGO_URI,
  jwtAccessSecret: process.env.JWT_ACCESS_SECRET,
  jwtResetSecret: process.env.JWT_RESET_SECRET,
  otpSecret: process.env.OTP_HMAC_SECRET,
  accessTtl: process.env.ACCESS_TOKEN_TTL || "15m",
  refreshDays: Number(process.env.REFRESH_TOKEN_DAYS) || 30,
  otpTtlMinutes: Number(process.env.OTP_TTL_MINUTES) || 5,
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS) || 5,
  otpCooldownSec: Number(process.env.OTP_RESEND_COOLDOWN_SEC) || 60,
  smsProvider: process.env.SMS_PROVIDER || "console",
  twilio: {
    sid: process.env.TWILIO_ACCOUNT_SID,
    token: process.env.TWILIO_AUTH_TOKEN,
    from: process.env.TWILIO_FROM,
  },
};
