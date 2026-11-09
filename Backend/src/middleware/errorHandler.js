module.exports = (err, req, res, next) => {
  if (err.code === 11000) {
    return res.status(409).json({ success: false, code: "DUPLICATE", message: "Already exists" });
  }
  const status = err.status || 500;
  if (status === 500) console.error(err);
  res.status(status).json({
    success: false,
    code: err.code || "SERVER_ERROR",
    message: status === 500 ? "Something went wrong" : err.message,
    ...(err.details ? { details: err.details } : {}),
  });
};
