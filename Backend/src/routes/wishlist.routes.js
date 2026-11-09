const router = require("express").Router();
const c = require("../controllers/wishlist.controller");
const { protect } = require("../middleware/auth");
const idParam = require("../utils/idParam");

router.use(protect);
router.get("/", c.getWishlist);
router.post("/:productId", idParam("productId"), c.addToWishlist);
router.delete("/:productId", idParam("productId"), c.removeFromWishlist);

module.exports = router;
