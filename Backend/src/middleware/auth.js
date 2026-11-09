const jwt = require("jsonwebtoken");
const env = require("../config/env");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

exports.protect = asyncHandler(async (req, res, next) => {
  const h = req.headers.authorization || "";
  if (!h.startsWith("Bearer ")) throw new ApiError(401, "Login required", "NO_TOKEN");
  let payload;
  try {
    payload = jwt.verify(h.slice(7), env.jwtAccessSecret);
  } catch {
    throw new ApiError(401, "Token expired", "TOKEN_EXPIRED"); // app refresh call karega
  }
  const user = await User.findById(payload.sub);
  if (!user || user.status !== "active") throw new ApiError(401, "Account unavailable", "NO_USER");
  req.user = user;
  next();
});

exports.restrictTo = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(new ApiError(403, "Not allowed", "FORBIDDEN"));
