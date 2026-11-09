const router = require("express").Router();
const c = require("../controllers/wallet.controller");
const rateLimit = require("express-rate-limit");

const limiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });

router.post("/webhook", limiter, c.webhook);

module.exports = router;
