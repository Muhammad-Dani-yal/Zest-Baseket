const router = require("express").Router();
const c = require("../controllers/user.controller");
const v = require("../middleware/validate");
const s = require("../validators/user.schema");
const { protect } = require("../middleware/auth");
const { authLimiter } = require("../middleware/rateLimit");

router.use(protect);
router.get("/", c.getMe);
router.patch("/", v(s.updateProfile), c.updateMe);
router.post("/change-password", authLimiter, v(s.changePassword), c.changePassword);
router.put("/push-token", v(s.pushToken), c.setPushToken);
router.post("/logout-all", c.logoutAll);
router.delete("/", authLimiter, v(s.deleteAccount), c.deleteMe);

module.exports = router;
