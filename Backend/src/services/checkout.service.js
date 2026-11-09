const Address = require("../models/Address");
const User = require("../models/User");
const pricing = require("../config/pricing");
const { SERVICE_RADIUS_KM, haversineKm, round1 } = require("../utils/geo");
const { calculateFee } = require("./fee.service");
const { loadCart, buildView } = require("./cart.service");

// Quote aur order dono isi se guzarte hain, taake dono jagah hisaab ek jaisa rahe.
async function evaluateCheckout(userId, addressId) {
  const problems = [];
  const cart = await loadCart(userId);
  const view = buildView(cart);
  if (!view.groups.length) problems.push({ code: "CART_EMPTY", message: "Your cart is empty" });

  const address = addressId
    ? await Address.findOne({ _id: addressId, user: userId })
    : await Address.findOne({ user: userId }).sort({ isDefault: -1, createdAt: -1 });
  if (!address) problems.push({ code: "ADDRESS_REQUIRED", message: "Select a delivery address" });

  if (view.groups.length > pricing.maxShopsPerOrder)
    problems.push({ code: "TOO_MANY_SHOPS", message: `You can order from at most ${pricing.maxShopsPerOrder} shops at once` });

  const customer = address && { lat: address.location.coordinates[1], lng: address.location.coordinates[0] };

  for (const g of view.groups) {
    const s = g.shop;
    if (s.status !== "approved") problems.push({ code: "SHOP_UNAVAILABLE", shopId: s.id, message: `${s.name} is not available` });
    else if (!s.isOpen) problems.push({ code: "SHOP_CLOSED", shopId: s.id, message: `${s.name} is closed right now` });
    if (!g.meetsMinOrder)
      problems.push({ code: "BELOW_MIN_ORDER", shopId: s.id, message: `${s.name}: minimum order is Rs. ${s.minOrder}` });
    if (customer) {
      const km = haversineKm(customer.lat, customer.lng, s.lat, s.lng);
      if (km > SERVICE_RADIUS_KM)
        problems.push({ code: "OUT_OF_RANGE", shopId: s.id, message: `${s.name} is ${round1(km)} km away; we deliver within ${SERVICE_RADIUS_KM} km` });
    }
    for (const it of g.items) {
      if (it.issue === "UNAVAILABLE") problems.push({ code: "ITEM_UNAVAILABLE", productId: it.productId, message: `${it.name} is out of stock` });
      if (it.issue === "INSUFFICIENT_STOCK")
        problems.push({ code: "INSUFFICIENT_STOCK", productId: it.productId, message: `Only ${it.stock} of ${it.name} left` });
    }
  }

  let fee = null;
  let deliveryFee = 0;
  if (customer && view.groups.length) {
    fee = calculateFee({ shops: view.groups.map((g) => ({ ...g.shop })), customer, itemsTotal: view.itemsTotal });
    deliveryFee = fee.deliveryFee;
  }
  const total = view.itemsTotal + deliveryFee;
  const user = await User.findById(userId);

  return {
    view,
    address,
    fee,
    problems,
    totals: { itemsTotal: view.itemsTotal, deliveryFee, total },
    wallet: { balance: user.walletBalance, enough: user.walletBalance >= total },
  };
}

module.exports = { evaluateCheckout };
