const ApiError = require("../utils/ApiError");

// source: "body" (default) ya "query"
module.exports = (schema, source = "body") => (req, res, next) => {
  const r = schema.safeParse(req[source]);
  if (!r.success) {
    const msg = r.error.issues.map((i) => i.message).join(", ");
    return next(new ApiError(400, msg, "VALIDATION_ERROR"));
  }
  req[source] = r.data;
  next();
};
