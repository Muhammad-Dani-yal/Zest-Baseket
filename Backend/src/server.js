const http = require("http");
const env = require("./config/env");
const connectDB = require("./config/db");
const app = require("./app");
const { initSockets } = require("./sockets");

connectDB()
  .then(() => {
    const server = http.createServer(app);
    initSockets(server); // Socket.io usi port par chalta hai
    server.listen(env.port, () => console.log(`ZestBasket API + sockets running on port ${env.port}`));
  })
  .catch((e) => {
    console.error("Startup failed:", e.message);
    process.exit(1);
  });
