const env = require("../config/env");

async function sendSms(phone, message) {
  if (env.smsProvider === "twilio") {
    // npm i twilio  (only needed in production)
    const twilio = require("twilio")(env.twilio.sid, env.twilio.token);
    await twilio.messages.create({ to: phone, from: env.twilio.from, body: message });
    return;
  }
  if (env.smsProvider === "custom") {
    // Pakistani SMS gateway ka API yahan lagana hai.
    throw new Error("Custom SMS gateway not configured yet");
  }
  // development: terminal mein OTP print hoga
  console.log(`\n[SMS -> ${phone}] ${message}\n`);
}

module.exports = { sendSms };
