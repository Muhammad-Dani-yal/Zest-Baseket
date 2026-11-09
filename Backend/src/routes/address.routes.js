const router = require("express").Router();
const c = require("../controllers/address.controller");
const v = require("../middleware/validate");
const s = require("../validators/order.schema");
const { protect } = require("../middleware/auth");
const idParam = require("../utils/idParam");

router.use(protect);
router.get("/", c.list);
router.post("/", v(s.address), c.create);
router.patch("/:id", idParam("id"), v(s.addressUpdate), c.update);
router.delete("/:id", idParam("id"), c.remove);

module.exports = router;
