const router = require("express").Router();
const c = require("../controllers/auth.controller");
const v = require("../middleware/validate");
const s = require("../validators/auth.schema");
const { protect } = require("../middleware/auth");
const { authLimiter, otpLimiter } = require("../middleware/rateLimit");

router.post("/signup", authLimiter, v(s.signup), c.signup);
router.post("/login", authLimiter, v(s.login), c.login);

router.post("/otp/send", otpLimiter, v(s.sendOtp), c.sendOtp);
router.post("/otp/verify", authLimiter, v(s.verifyOtp), c.verifyOtp);

router.post("/forgot-password", otpLimiter, v(s.forgot), c.forgotPassword);
router.post("/verify-reset-otp", authLimiter, v(s.verifyReset), c.verifyResetOtp);
router.post("/reset-password", authLimiter, v(s.reset), c.resetPassword);

router.post("/refresh", v(s.refresh), c.refresh);
router.post("/logout", v(s.refresh), c.logout);
router.get("/me", protect, c.me);

module.exports = router;
