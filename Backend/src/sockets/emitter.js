// Socket.io ka reference yahan rakha hai, taake REST controllers bhi events bhej sakein
let io = null;

const setIO = (instance) => { io = instance; };

// Order ke room + customer + rider ke personal rooms mein ek hi event (har socket ko ek baar milta hai)
function emitOrder(order, event, payload) {
  if (!io) return;
  let target = io.to(`order:${order._id}`).to(`user:${order.user}`);
  if (order.rider) target = target.to(`user:${order.rider}`);
  target.emit(event, payload);
}

module.exports = { setIO, emitOrder };
