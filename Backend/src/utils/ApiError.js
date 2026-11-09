class ApiError extends Error {
  constructor(status, message, code, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details; // optional: extra info (jaise checkout problems ki list)
  }
}
module.exports = ApiError;
