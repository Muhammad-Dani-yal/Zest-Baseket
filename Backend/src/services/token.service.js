const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const RefreshToken = require("../models/RefreshToken");
const env = require("../config/env");
const ApiError = require("../utils/ApiError");

const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");

const signAccess = (user) =>
  jwt.sign({ sub: String(user._id), role: user.role }, env.jwtAccessSecret, { expiresIn: env.accessTtl });

async function issueRefresh(user, device, family = crypto.randomUUID()) {
  const token = crypto.randomBytes(48).toString("hex");
  await RefreshToken.create({
    user: user._id,
    tokenHash: sha(token),
    family,
    device,
    expiresAt: new Date(Date.now() + env.refreshDays * 86400000),
  });
  return token;
}

async function issueTokens(user, device) {
  return { accessToken: signAccess(user), refreshToken: await issueRefresh(user, device) };
}

// Rotation: har refresh par naya token, purana revoke.
// Revoke ho chuka token dobara aaye to poori family revoke (chori ka shak).
async function rotate(refreshToken, User) {
  const doc = await RefreshToken.findOne({ tokenHash: sha(refreshToken) });
  if (!doc) throw new ApiError(401, "Invalid session", "SESSION_INVALID");
  if (doc.revokedAt) {
    await RefreshToken.updateMany({ family: doc.family, revokedAt: null }, { revokedAt: new Date() });
    throw new ApiError(401, "Session expired. Please login again", "SESSION_REUSED");
  }
  if (doc.expiresAt < new Date()) throw new ApiError(401, "Session expired", "SESSION_EXPIRED");

  const user = await User.findById(doc.user);
  if (!user || user.status !== "active") throw new ApiError(401, "Account unavailable", "SESSION_INVALID");

  doc.revokedAt = new Date();
  await doc.save();
  return {
    user,
    accessToken: signAccess(user),
    refreshToken: await issueRefresh(user, doc.device, doc.family),
  };
}

async function revoke(refreshToken) {
  await RefreshToken.updateOne({ tokenHash: sha(refreshToken), revokedAt: null }, { revokedAt: new Date() });
}

const revokeAllForUser = (userId) =>
  RefreshToken.updateMany({ user: userId, revokedAt: null }, { revokedAt: new Date() });

const signReset = (user) =>
  jwt.sign({ sub: String(user._id), purpose: "reset" }, env.jwtResetSecret, { expiresIn: "10m" });

function verifyReset(token) {
  try {
    const p = jwt.verify(token, env.jwtResetSecret);
    if (p.purpose !== "reset") throw new Error();
    return p;
  } catch {
    throw new ApiError(400, "Reset session expired. Start again", "RESET_INVALID");
  }
}

module.exports = { issueTokens, rotate, revoke, revokeAllForUser, signReset, verifyReset };
