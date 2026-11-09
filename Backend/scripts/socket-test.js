// Use: node scripts/socket-test.js <accessToken> <orderId>
// Ye customer ban kar order ka room join karta hai aur jo bhi live events aate hain print karta hai.
const { io } = require("socket.io-client");

const [token, orderId] = process.argv.slice(2);
if (!token || !orderId) {
  console.log("Use: node scripts/socket-test.js <accessToken> <orderId>");
  process.exit(1);
}

const socket = io(process.env.API_URL || "http://localhost:5000", { auth: { token } });

socket.on("connect", () => {
  console.log("Connected:", socket.id);
  socket.emit("order:join", { orderId }, (res) => console.log("order:join ->", JSON.stringify(res)));
});
socket.on("connect_error", (e) => console.log("Connect error:", e.message));
for (const ev of ["order:update", "rider:assigned", "rider:location", "pickup:verified", "chat:message", "chat:typing", "chat:read"]) {
  socket.on(ev, (data) => console.log(`[${new Date().toLocaleTimeString()}] ${ev}`, JSON.stringify(data)));
}
console.log("Waiting for events... (Ctrl + C se band karein)");
