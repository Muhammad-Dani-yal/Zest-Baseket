const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");
const { z } = require("zod");
const env = require("../config/env");
const User = require("../models/User");
const ApiError = require("../utils/ApiError");
const { setIO } = require("./emitter");
const chat = require("../services/chat.service");
const tracking = require("../services/tracking.service");

const parse = (schema, data) => {
  const r = schema.safeParse(data);
  if (!r.success) throw new ApiError(400, r.error.issues[0].message, "VALIDATION_ERROR");
  return r.data;
};

const orderId = z.object({ orderId: z.string() });
const sendSchema = z.object({ orderId: z.string(), text: z.string() });
const typingSchema = z.object({ orderId: z.string(), typing: z.boolean() });
const locSchema = z.object({ orderId: z.string() }).passthrough();

// Har event ka jawab ack callback se: { ok: true, ... } ya { ok: false, code, message }
const wrap = (fn) => (data, cb) => {
  Promise.resolve()
    .then(() => fn(data))
    .then((res) => typeof cb === "function" && cb({ ok: true, ...(res || {}) }))
    .catch((e) => {
      if (!e.status) console.error("socket error:", e);
      typeof cb === "function" && cb({ ok: false, code: e.code || "ERROR", message: e.status && e.status < 500 ? e.message : "Something went wrong" });
    });
};

function initSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: true } });
  setIO(io);

  // Connect hone se pehle login token check
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token || (socket.handshake.headers.authorization || "").replace(/^Bearer /, "");
      const payload = jwt.verify(token, env.jwtAccessSecret);
      const user = await User.findById(payload.sub);
      if (!user || user.status !== "active") throw new Error("no user");
      socket.data.user = user;
      next();
    } catch {
      next(new Error("UNAUTHORIZED"));
    }
  });

  io.on("connection", (socket) => {
    const user = socket.data.user;
    socket.join(`user:${user._id}`); // personal room: is user ke saare orders ke updates

    // Order ka room join (Tracking / Chat screen khulne par)
    socket.on("order:join", wrap(async (d) => {
      const { order } = await chat.loadOrderFor(parse(orderId, d).orderId, user);
      await socket.join(`order:${order._id}`);
      return { status: order.status, location: tracking.getLocation(order) };
    }));

    socket.on("order:leave", wrap(async (d) => {
      socket.leave(`order:${parse(orderId, d).orderId}`);
    }));

    // Rider ki live location
    socket.on("rider:location", wrap(async (d) => {
      const { orderId: id } = parse(locSchema, d);
      const { order } = await chat.loadOrderFor(id, user);
      await tracking.updateRiderLocation(order, user, d);
    }));

    // Chat
    socket.on("chat:send", wrap(async (d) => {
      const x = parse(sendSchema, d);
      const { order, role } = await chat.loadOrderFor(x.orderId, user);
      return { message: await chat.sendMessage(order, role, user, x.text) };
    }));

    socket.on("chat:typing", wrap(async (d) => {
      const x = parse(typingSchema, d);
      const { order, role } = await chat.loadOrderFor(x.orderId, user);
      socket.to(`order:${order._id}`).emit("chat:typing", { orderId: String(order._id), role, typing: x.typing });
    }));

    socket.on("chat:read", wrap(async (d) => {
      const { order, role } = await chat.loadOrderFor(parse(orderId, d).orderId, user);
      return { marked: await chat.markRead(order, role, user) };
    }));
  });

  return io;
}

module.exports = { initSockets };
