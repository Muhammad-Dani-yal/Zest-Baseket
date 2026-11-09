// Delivery fee ke rates (PKR). .env se badle ja sakte hain; baad mein admin panel se.
const n = (v, d) => (Number.isFinite(Number(v)) && v !== undefined && v !== "" ? Number(v) : d);

module.exports = {
  baseFee: n(process.env.DELIVERY_BASE_FEE, 60),
  perKm: n(process.env.DELIVERY_PER_KM, 15),
  perExtraShop: n(process.env.DELIVERY_PER_EXTRA_SHOP, 30),
  minFee: n(process.env.DELIVERY_MIN_FEE, 80),
  freeAbove: n(process.env.FREE_DELIVERY_ABOVE, 2500),
  roadFactor: 1.3, // seedhi line distance ko sadak ki distance mein badalne ke liye
  maxShopsPerOrder: n(process.env.MAX_SHOPS_PER_ORDER, 3),
  maxQtyPerItem: 20,
};
