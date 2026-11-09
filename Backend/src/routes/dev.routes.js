const router = require("express").Router();
const c = require("../controllers/dev.controller");
const v = require("../middleware/validate");
const s = require("../validators/order.schema");
const { protect } = require("../middleware/auth");
const idParam = require("../utils/idParam");

router.use(protect);
router.post("/role", v(s.devRole), c.setRole);
router.post("/orders/:id/accept", idParam("id"), c.accept);
router.post("/orders/:id/ready", idParam("id"), c.ready);
router.post("/wallet/topup/:id/confirm", idParam("id"), c.confirmTopUp);
router.post("/orders/:id/assign-me", idParam("id"), c.assignMe);

module.exports = router;
