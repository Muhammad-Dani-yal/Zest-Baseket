const router = require("express").Router();
const c = require("../controllers/rider.controller");
const chat = require("../controllers/chat.controller");
const cs = require("../validators/chat.schema");
const v = require("../middleware/validate");
const s = require("../validators/order.schema");
const { protect, restrictTo } = require("../middleware/auth");
const idParam = require("../utils/idParam");
const { authLimiter } = require("../middleware/rateLimit");

router.use(protect, restrictTo("rider"));
router.post("/orders/:id/sub-orders/:subId/pickup", authLimiter, idParam("id", "subId"), v(s.pickup), c.pickup);
router.post("/orders/:id/location", idParam("id"), v(cs.location), chat.riderLocation);
router.post("/orders/:id/deliver", authLimiter, idParam("id"), v(s.deliver), c.deliver);

module.exports = router;
