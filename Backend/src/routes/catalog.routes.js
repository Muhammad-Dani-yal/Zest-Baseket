const router = require("express").Router();
const c = require("../controllers/catalog.controller");
const v = require("../middleware/validate");
const s = require("../validators/catalog.schema");
const idParam = require("../utils/idParam");

router.get("/categories", c.categories);
router.get("/home", v(s.home, "query"), c.home);

router.get("/shops", v(s.shops, "query"), c.listShops);
router.get("/shops/:id", idParam("id"), v(s.shopDetails, "query"), c.getShop);
router.get("/shops/:id/products", idParam("id"), v(s.shopProducts, "query"), c.listShopProducts);

router.get("/products/search", v(s.searchProducts, "query"), c.searchProducts); // :id se pehle
router.get("/products/:id", idParam("id"), c.getProduct);

module.exports = router;
