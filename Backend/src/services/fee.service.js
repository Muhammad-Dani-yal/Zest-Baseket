const pricing = require("../config/pricing");
const { haversineKm } = require("../utils/geo");

const round1 = (n) => Math.round(n * 10) / 10;
const roundTo5 = (n) => Math.round(n / 5) * 5;

// Rider ka route: sab se door shop se shuru, phir sab se nazdeek agli shop, aakhir mein customer.
// shops: [{id, name, lat, lng}], customer: {lat, lng}
function planRoute(shops, customer) {
  const left = [...shops];
  const first = left.reduce((a, b) =>
    haversineKm(a.lat, a.lng, customer.lat, customer.lng) >= haversineKm(b.lat, b.lng, customer.lat, customer.lng) ? a : b
  );
  const order = [first];
  left.splice(left.indexOf(first), 1);
  while (left.length) {
    const cur = order[order.length - 1];
    const next = left.reduce((a, b) =>
      haversineKm(cur.lat, cur.lng, a.lat, a.lng) <= haversineKm(cur.lat, cur.lng, b.lat, b.lng) ? a : b
    );
    order.push(next);
    left.splice(left.indexOf(next), 1);
  }
  const points = [...order, { name: "Customer", lat: customer.lat, lng: customer.lng }];
  const legs = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const km = haversineKm(points[i].lat, points[i].lng, points[i + 1].lat, points[i + 1].lng) * pricing.roadFactor;
    legs.push({ from: points[i].name, to: points[i + 1].name, km: round1(km) });
    total += km;
  }
  return { stops: order.map((s) => s.name), legs, distanceKm: round1(total) };
}

// fee = base + (km x perKm) + (extra shops x perExtraShop), kam az kam minFee, 5 ke multiple mein.
function calculateFee({ shops, customer, itemsTotal }) {
  const route = planRoute(shops, customer);
  const baseFee = pricing.baseFee;
  const distanceFee = Math.round(route.distanceKm * pricing.perKm);
  const extraShopsFee = Math.max(0, shops.length - 1) * pricing.perExtraShop;
  const originalFee = Math.max(pricing.minFee, roundTo5(baseFee + distanceFee + extraShopsFee));
  const freeDeliveryApplied = itemsTotal >= pricing.freeAbove;
  return {
    route,
    breakdown: {
      distanceKm: route.distanceKm,
      baseFee,
      distanceFee,
      extraShopsFee,
      originalFee,
      freeDeliveryApplied,
    },
    deliveryFee: freeDeliveryApplied ? 0 : originalFee,
  };
}

module.exports = { planRoute, calculateFee };
