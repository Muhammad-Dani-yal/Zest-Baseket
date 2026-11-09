const mongoose = require("mongoose");
const ApiError = require("./ApiError");

// router.get("/:id", idParam("id"), ...)  -> galat id par 400 (500 nahi)
module.exports = (...names) => (req, res, next) => {
  for (const n of names) {
    if (!mongoose.isValidObjectId(req.params[n])) return next(new ApiError(400, "Invalid id", "INVALID_ID"));
  }
  next();
};
