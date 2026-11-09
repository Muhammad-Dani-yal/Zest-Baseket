const crypto = require("crypto");
const mongoose = require("mongoose");
const User = require("../models/User");
const TopUp = require("../models/TopUp");
const WalletTransaction = require("../models/WalletTransaction");
const ApiError = require("../utils/ApiError");

const MIN_TOPUP = 100;
const MAX_TOPUP = 20000;
const MAX_BALANCE = 50000;

// Wallet mein paisa daalna: balance aur ledger ki entry hamesha saath (session ke andar)
async function creditWallet(userId, amount, reason, { order, note, session } = {}) {
  const u = await User.findOneAndUpdate({ _id: userId }, { $inc: { walletBalance: amount } }, { new: true, session });
  const [tx] = await WalletTransaction.create(
    [{ user: userId, type: "credit", amount, reason, order, note, balanceAfter: u.walletBalance }],
    { session }
  );
  return { balance: u.walletBalance, tx };
}

// Provider ne payment confirm ki: top-up "paid" aur wallet credit, ek hi transaction mein.
// Dobara confirm aaye (webhook retry) to dobara credit nahi hota.
async function confirmTopUp(topUpId, paidAmount) {
  const session = await mongoose.startSession();
  let out;
  try {
    await session.withTransaction(async () => {
      const t = await TopUp.findOneAndUpdate(
        { _id: topUpId, status: "pending" },
        { $set: { status: "paid", paidAt: new Date() } },
        { new: true, session }
      );
      if (!t) {
        out = { already: true, topUp: await TopUp.findById(topUpId).session(session) };
        return;
      }
      if (paidAmount != null && Number(paidAmount) !== t.amount)
        throw new ApiError(400, "Paid amount does not match the top-up amount", "AMOUNT_MISMATCH"); // transaction wapas
      const { balance } = await creditWallet(t.user, t.amount, "topup", { note: `Top-up ${t.providerRef}`, session });
      out = { already: false, topUp: t, balance };
    });
  } finally {
    session.endSession();
  }
  return out;
}

const newReference = () => `ZBTU-${crypto.randomBytes(8).toString("hex").toUpperCase()}`;

// Webhook ka signature check: HMAC-SHA256(rawBody, secret) header "x-signature" mein hex
function verifySignature(rawBody, signature, secret) {
  if (!rawBody || !signature || !secret) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { creditWallet, confirmTopUp, newReference, verifySignature, MIN_TOPUP, MAX_TOPUP, MAX_BALANCE };
