const router = require("express").Router();
const c = require("../controllers/wallet.controller");
const v = require("../middleware/validate");
const s = require("../validators/wallet.schema");
const { protect } = require("../middleware/auth");
const idParam = require("../utils/idParam");

router.use(protect);
router.get("/", c.getWallet);
router.get("/transactions", v(s.transactions, "query"), c.transactions);
router.post("/topup", v(s.topup), c.topup);
router.get("/topup/:id", idParam("id"), c.getTopUp);

module.exports = router;
