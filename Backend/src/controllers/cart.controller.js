const Cart = require("../models/Cart");
const Product = require("../models/Product");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const pricing = require("../config/pricing");
const { loadCart, buildView } = require("../services/cart.service");

const respond = async (res, userId, status = 200) => {
  const cart = await loadCart(userId);
  res.status(status).json({ success: true, cart: buildView(cart) });
};

// 10: Cart dekhna
exports.getCart = asyncHandler(async (req, res) => respond(res, req.user._id));

// Item add (pehle se ho to qty barh jati hai)
exports.addItem = asyncHandler(async (req, res) => {
  const { productId, qty } = req.body;
  const product = await Product.findById(productId).populate("shop", "status");
  if (!product || product.shop?.status !== "approved") throw new ApiError(404, "Product not found", "PRODUCT_NOT_FOUND");
  if (!product.isAvailable || product.stock <= 0) throw new ApiError(409, "This item is out of stock", "OUT_OF_STOCK");

  const cart = (await loadCart(req.user._id)) || new Cart({ user: req.user._id, items: [] });
  const existing = cart.items.find((i) => String(i.product?._id || i.product) === String(productId));

  if (!existing) {
    const shopIds = new Set(cart.items.map((i) => String(i.product?.shop?._id)).filter(Boolean));
    if (!shopIds.has(String(product.shop._id)) && shopIds.size >= pricing.maxShopsPerOrder)
      throw new ApiError(409, `You can order from at most ${pricing.maxShopsPerOrder} shops at once`, "MAX_SHOPS");
  }

  const newQty = (existing?.qty || 0) + qty;
  const limit = Math.min(product.stock, pricing.maxQtyPerItem);
  if (newQty > limit) throw new ApiError(409, `Only ${limit} available`, "QTY_LIMIT");

  if (existing) existing.qty = newQty;
  else cart.items.push({ product: product._id, qty: newQty });
  await cart.save();
  await respond(res, req.user._id, 201);
});

// Qty badalna
exports.updateItem = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.productId);
  if (!product) throw new ApiError(404, "Product not found", "PRODUCT_NOT_FOUND");
  const limit = Math.min(product.stock, pricing.maxQtyPerItem);
  if (req.body.qty > limit) throw new ApiError(409, `Only ${limit} available`, "QTY_LIMIT");

  const r = await Cart.updateOne(
    { user: req.user._id, "items.product": req.params.productId },
    { $set: { "items.$.qty": req.body.qty } }
  );
  if (!r.matchedCount) throw new ApiError(404, "Item not in cart", "NOT_IN_CART");
  await respond(res, req.user._id);
});

exports.removeItem = asyncHandler(async (req, res) => {
  await Cart.updateOne({ user: req.user._id }, { $pull: { items: { product: req.params.productId } } });
  await respond(res, req.user._id);
});

exports.clearCart = asyncHandler(async (req, res) => {
  await Cart.updateOne({ user: req.user._id }, { $set: { items: [] } });
  await respond(res, req.user._id);
});
