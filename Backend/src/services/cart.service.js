const Cart = require("../models/Cart");
const pricing = require("../config/pricing");

const loadCart = (userId) =>
  Cart.findOne({ user: userId }).populate({ path: "items.product", populate: { path: "shop" } });

// Cart ko shop ke hisaab se group kar ke live price/stock ke saath dikhata hai
function buildView(cart) {
  const groups = new Map();
  let itemCount = 0;
  let itemsTotal = 0;

  for (const it of cart?.items || []) {
    const p = it.product;
    if (!p || !p.shop) continue; // delete ho chuka product/shop
    const key = String(p.shop._id);
    if (!groups.has(key)) {
      groups.set(key, {
        shop: {
          id: p.shop._id,
          name: p.shop.name,
          isOpen: p.shop.isOpen,
          status: p.shop.status,
          minOrder: p.shop.minOrder || 0,
          deliveryTimeMin: p.shop.deliveryTimeMin,
          lat: p.shop.location.coordinates[1],
          lng: p.shop.location.coordinates[0],
        },
        items: [],
        subtotal: 0,
      });
    }
    const g = groups.get(key);
    const available = p.isAvailable && p.stock > 0;
    const issue = !available ? "UNAVAILABLE" : it.qty > p.stock ? "INSUFFICIENT_STOCK" : null;
    const lineTotal = p.price * it.qty;
    g.items.push({
      productId: p._id,
      name: p.name,
      unit: p.unit,
      image: p.image,
      price: p.price,
      qty: it.qty,
      lineTotal,
      stock: p.stock,
      isAvailable: available,
      issue,
    });
    g.subtotal += lineTotal;
    itemCount += it.qty;
    itemsTotal += lineTotal;
  }

  const list = [...groups.values()].map((g) => ({ ...g, meetsMinOrder: g.subtotal >= g.shop.minOrder }));
  return { groups: list, shopCount: list.length, itemCount, itemsTotal };
}

module.exports = { loadCart, buildView, maxQty: pricing.maxQtyPerItem };
