const router = require("express").Router();
const c = require("../controllers/order.controller");
const m = require("../controllers/orderManage.controller");
const chat = require("../controllers/chat.controller");
const cs = require("../validators/chat.schema");
const v = require("../middleware/validate");
const s = require("../validators/order.schema");
const { protect } = require("../middleware/auth");
const idParam = require("../utils/idParam");
const rateLimit = require("express-rate-limit");

const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, code: "RATE_LIMITED", message: "Too many order attempts. Try again shortly" },
});

router.use(protect);
router.get("/", v(s.list, "query"), m.list); // 17: My Orders
router.post("/quote", v(s.quote), c.quote); // 11
router.post("/", orderLimiter, v(s.create), c.create); // 11 -> 12

router.get("/:id", idParam("id"), c.getOrder); // 12
router.get("/:id/receipt", idParam("id"), c.receipt); // 13
router.get("/:id/pickups", idParam("id"), m.pickups); // 15
router.get("/:id/delivery-otp", idParam("id"), m.deliveryOtp); // 16
router.get("/:id/tracking", idParam("id"), chat.tracking); // 14
router.get("/:id/messages", idParam("id"), v(cs.history, "query"), chat.history); // 21
router.post("/:id/messages", idParam("id"), v(cs.send), chat.send);
router.post("/:id/messages/read", idParam("id"), chat.read);
router.post("/:id/cancel", idParam("id"), v(s.cancel), m.cancel);
router.post("/:id/reorder", idParam("id"), m.reorder);

module.exports = router;
