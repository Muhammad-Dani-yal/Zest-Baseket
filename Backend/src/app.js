const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const env = require("./config/env");
const errorHandler = require("./middleware/errorHandler");

const app = express();
app.set("trust proxy", 1); // Render/Railway ke peeche sahi IP ke liye
app.use(helmet());
app.use(cors()); // React Native app ko CORS ki zaroorat nahi; web panels ke liye baad mein origin limit karna
app.use(express.json({ limit: "100kb", verify: (req, res, buf) => { req.rawBody = buf; } })); // rawBody: webhook signature ke liye
if (env.nodeEnv !== "test") app.use(morgan("dev"));

app.get("/health", (req, res) => res.json({ ok: true }));
app.use("/api/v1/auth", require("./routes/auth.routes"));
app.use("/api/v1/wishlist", require("./routes/wishlist.routes"));
app.use("/api/v1/cart", require("./routes/cart.routes"));
app.use("/api/v1/users/me/addresses", require("./routes/address.routes"));
app.use("/api/v1/users/me", require("./routes/user.routes"));
app.use("/api/v1/orders", require("./routes/order.routes"));
app.use("/api/v1/wallet", require("./routes/wallet.routes"));
app.use("/api/v1/payments", require("./routes/payments.routes"));
app.use("/api/v1/rider", require("./routes/rider.routes"));
if (env.nodeEnv !== "production") app.use("/api/v1/dev", require("./routes/dev.routes")); // sirf testing
app.use("/api/v1", require("./routes/catalog.routes"));

app.use((req, res) => res.status(404).json({ success: false, code: "NOT_FOUND", message: "Route not found" }));
app.use(errorHandler);

module.exports = app;
