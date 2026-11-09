const Wishlist = require("../models/Wishlist");
const Product = require("../models/Product");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { productDTO } = require("./catalog.controller");

// 19: Wishlist dekhna
exports.getWishlist = asyncHandler(async (req, res) => {
  const w = await Wishlist.findOne({ user: req.user._id }).populate({
    path: "products",
    populate: { path: "shop", select: "name isOpen" },
  });
  const products = (w?.products || []).filter(Boolean); // delete ho chuke products hata do
  res.json({ success: true, count: products.length, productIds: products.map((p) => p._id), products: products.map(productDTO) });
});

exports.addToWishlist = asyncHandler(async (req, res) => {
  if (!(await Product.exists({ _id: req.params.productId }))) throw new ApiError(404, "Product not found", "PRODUCT_NOT_FOUND");
  const w = await Wishlist.findOneAndUpdate(
    { user: req.user._id },
    { $addToSet: { products: req.params.productId } }, // dobara add karne par duplicate nahi banta
    { upsert: true, new: true }
  );
  res.status(201).json({ success: true, count: w.products.length, productIds: w.products });
});

exports.removeFromWishlist = asyncHandler(async (req, res) => {
  const w = await Wishlist.findOneAndUpdate({ user: req.user._id }, { $pull: { products: req.params.productId } }, { new: true });
  res.json({ success: true, count: w?.products.length || 0, productIds: w?.products || [] });
});
