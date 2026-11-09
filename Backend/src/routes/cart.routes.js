const router = require("express").Router();
const c = require("../controllers/cart.controller");
const v = require("../middleware/validate");
const s = require("../validators/cart.schema");
const { protect } = require("../middleware/auth");
const idParam = require("../utils/idParam");

router.use(protect);
router.get("/", c.getCart);
router.post("/items", v(s.addItem), c.addItem);
router.patch("/items/:productId", idParam("productId"), v(s.updateItem), c.updateItem);
router.delete("/items/:productId", idParam("productId"), c.removeItem);
router.delete("/", c.clearCart);

module.exports = router;
