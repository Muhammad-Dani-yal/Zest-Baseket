const User = require("../models/User");
const TopUp = require("../models/TopUp");
const WalletTransaction = require("../models/WalletTransaction");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { newReference, confirmTopUp, verifySignature, MAX_BALANCE } = require("../services/wallet.service");

const txDTO = (t) => ({ id: t._id, type: t.type, amount: t.amount, reason: t.reason, orderId: t.order, balanceAfter: t.balanceAfter, note: t.note, createdAt: t.createdAt });
const topUpDTO = (t) => ({ id: t._id, amount: t.amount, provider: t.provider, status: t.status, reference: t.providerRef, createdAt: t.createdAt, paidAt: t.paidAt });

// 20: Wallet screen: balance + haal ki transactions
exports.getWallet = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const recent = await WalletTransaction.find({ user: user._id }).sort({ createdAt: -1 }).limit(5);
  res.json({ success: true, balance: user.walletBalance, currency: "PKR", recent: recent.map(txDTO) });
});

exports.transactions = asyncHandler(async (req, res) => {
  const { type, page, limit } = req.query;
  const filter = { user: req.user._id, ...(type ? { type } : {}) };
  const [list, total] = await Promise.all([
    WalletTransaction.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    WalletTransaction.countDocuments(filter),
  ]);
  res.json({ success: true, transactions: list.map(txDTO), pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
});

// Top-up shuru: sirf "pending" request banti hai, paisa provider ke confirm par aata hai
exports.topup = asyncHandler(async (req, res) => {
  const { amount, provider } = req.body;
  const live = provider !== "mock" || env.nodeEnv === "production";
  if (live) throw new ApiError(501, "This payment method is coming soon", "PROVIDER_NOT_CONFIGURED");

  const idemKey = (req.headers["idempotency-key"] || "").toString().slice(0, 80) || undefined;
  if (idemKey) {
    const dup = await TopUp.findOne({ user: req.user._id, idempotencyKey: idemKey });
    if (dup) return res.json({ success: true, duplicate: true, topUp: topUpDTO(dup) });
  }
  const user = await User.findById(req.user._id);
  if (user.walletBalance + amount > MAX_BALANCE)
    throw new ApiError(409, `Wallet balance cannot go above Rs. ${MAX_BALANCE}`, "BALANCE_LIMIT");

  const t = await TopUp.create({ user: user._id, amount, provider, providerRef: newReference(), idempotencyKey: idemKey });
  res.status(201).json({
    success: true,
    topUp: topUpDTO(t),
    payment: { provider, note: "Test mode: payment confirm karne ke liye /dev/wallet/topup/:id/confirm chalayein" },
  });
});

// App is se top-up ki halat poochti hai (gateway se wapas aane ke baad)
exports.getTopUp = asyncHandler(async (req, res) => {
  const t = await TopUp.findOne({ _id: req.params.id, user: req.user._id });
  if (!t) throw new ApiError(404, "Top-up not found", "TOPUP_NOT_FOUND");
  res.json({ success: true, topUp: topUpDTO(t) });
});

// Payment provider ka webhook (login nahi, signature se pehchan)
exports.webhook = asyncHandler(async (req, res) => {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!verifySignature(req.rawBody, req.headers["x-signature"], secret))
    throw new ApiError(401, "Invalid signature", "BAD_SIGNATURE");

  const { reference, status, amount } = req.body || {};
  const t = await TopUp.findOne({ providerRef: String(reference || "") });
  if (!t) throw new ApiError(404, "Unknown reference", "TOPUP_NOT_FOUND");

  if (status === "paid") {
    const r = await confirmTopUp(t._id, amount);
    return res.json({ success: true, received: true, alreadyProcessed: r.already });
  }
  if (status === "failed") await TopUp.updateOne({ _id: t._id, status: "pending" }, { $set: { status: "failed" } });
  res.json({ success: true, received: true });
});
