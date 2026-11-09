const mongoose = require("mongoose");
const Category = require("../models/Category");
const Shop = require("../models/Shop");
const Product = require("../models/Product");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { haversineKm, round1, SERVICE_RADIUS_KM } = require("../utils/geo");

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const categoryDTO = (c) => c && { id: c._id, name: c.name, slug: c.slug, icon: c.icon };

const shopDTO = (s, distanceKm) => ({
  id: s._id,
  name: s.name,
  description: s.description,
  category: categoryDTO(s.category),
  address: s.address,
  phone: s.phone,
  image: s.image,
  isOpen: s.isOpen,
  openingHours: s.openingHours,
  rating: s.rating,
  ratingCount: s.ratingCount,
  deliveryTimeMin: s.deliveryTimeMin,
  minOrder: s.minOrder,
  location: { lat: s.location.coordinates[1], lng: s.location.coordinates[0] },
  distanceKm,
});

const productDTO = (p) => ({
  id: p._id,
  name: p.name,
  description: p.description,
  price: p.price,
  unit: p.unit,
  image: p.image,
  section: p.section,
  stock: p.stock,
  isAvailable: p.isAvailable && p.stock > 0,
  shop: p.shop && p.shop._id ? { id: p.shop._id, name: p.shop.name, isOpen: p.shop.isOpen } : p.shop,
});

const pagination = (page, limit, total) => ({ page, limit, total, pages: Math.ceil(total / limit) });

// category slug ya id -> category doc
async function resolveCategory(value) {
  if (!value) return null;
  const c = mongoose.isValidObjectId(value)
    ? await Category.findById(value)
    : await Category.findOne({ slug: value.toLowerCase() });
  if (!c) throw new ApiError(404, "Category not found", "CATEGORY_NOT_FOUND");
  return c;
}

// 5 KM ke andar shops, distance ke saath. $geoNear hamesha pipeline ka pehla stage hota hai.
async function findNearbyShops({ lat, lng, radius, category, q, sort = "distance", openNow, page = 1, limit = 20 }) {
  const match = { status: "approved" };
  if (category) match.category = category._id; // aggregate mein ObjectId hi chalta hai
  if (q) match.name = { $regex: esc(q), $options: "i" };
  if (openNow === "true") match.isOpen = true;

  const pipeline = [
    {
      $geoNear: {
        near: { type: "Point", coordinates: [lng, lat] },
        distanceField: "distanceMeters",
        maxDistance: radius * 1000,
        spherical: true,
        query: match,
      },
    },
  ];
  if (sort === "rating") pipeline.push({ $sort: { rating: -1, distanceMeters: 1 } });
  pipeline.push({
    $facet: {
      items: [{ $skip: (page - 1) * limit }, { $limit: limit }],
      total: [{ $count: "n" }],
    },
  });

  const [res] = await Shop.aggregate(pipeline);
  const shops = await Shop.populate(res.items, { path: "category", select: "name slug icon" });
  return {
    shops: shops.map((s) => shopDTO(s, round1(s.distanceMeters / 1000))),
    total: res.total[0]?.n || 0,
  };
}

// 06: Categories
exports.categories = asyncHandler(async (req, res) => {
  const list = await Category.find({ isActive: true }).sort({ order: 1, name: 1 });
  res.json({ success: true, categories: list.map(categoryDTO) });
});

// 04: Home
exports.home = asyncHandler(async (req, res) => {
  const { lat, lng } = req.query;
  const radius = SERVICE_RADIUS_KM;
  const [categories, nearby] = await Promise.all([
    Category.find({ isActive: true }).sort({ order: 1, name: 1 }),
    findNearbyShops({ lat, lng, radius, limit: 10 }),
  ]);
  const shopIds = nearby.shops.map((s) => s.id);
  const popular = await Product.find({ shop: { $in: shopIds }, isAvailable: true, stock: { $gt: 0 } })
    .sort({ popularity: -1 })
    .limit(10)
    .populate("shop", "name isOpen");
  res.json({
    success: true,
    categories: categories.map(categoryDTO),
    nearbyShops: nearby.shops,
    popularProducts: popular.map(productDTO),
  });
});

// 05: Nearby shops
exports.listShops = asyncHandler(async (req, res) => {
  const { category: catValue, page, limit, ...rest } = req.query;
  const category = await resolveCategory(catValue);
  const { shops, total } = await findNearbyShops({ ...rest, category, page, limit });
  res.json({ success: true, shops, pagination: pagination(page, limit, total) });
});

// 07: Shop details
exports.getShop = asyncHandler(async (req, res) => {
  const shop = await Shop.findOne({ _id: req.params.id, status: "approved" }).populate("category", "name slug icon");
  if (!shop) throw new ApiError(404, "Shop not found", "SHOP_NOT_FOUND");
  const { lat, lng } = req.query;
  const distanceKm =
    lat != null && lng != null
      ? round1(haversineKm(lat, lng, shop.location.coordinates[1], shop.location.coordinates[0]))
      : undefined;
  res.json({ success: true, shop: shopDTO(shop, distanceKm) });
});

// 08: Shop ke products
exports.listShopProducts = asyncHandler(async (req, res) => {
  const { section, q, page, limit } = req.query;
  const shopId = req.params.id;
  if (!(await Shop.exists({ _id: shopId, status: "approved" }))) throw new ApiError(404, "Shop not found", "SHOP_NOT_FOUND");

  const filter = { shop: shopId };
  if (section) filter.section = section;
  if (q) filter.name = { $regex: esc(q), $options: "i" };

  const [products, total, sections] = await Promise.all([
    Product.find(filter).sort({ section: 1, popularity: -1 }).skip((page - 1) * limit).limit(limit),
    Product.countDocuments(filter),
    Product.distinct("section", { shop: shopId }),
  ]);
  res.json({ success: true, sections: sections.sort(), products: products.map(productDTO), pagination: pagination(page, limit, total) });
});

// 09: Product details
exports.getProduct = asyncHandler(async (req, res) => {
  const p = await Product.findById(req.params.id).populate("shop", "name isOpen status");
  if (!p || p.shop?.status !== "approved") throw new ApiError(404, "Product not found", "PRODUCT_NOT_FOUND");
  res.json({ success: true, product: productDTO(p) });
});

// Search: nazdeeki shops ke products mein naam se
exports.searchProducts = asyncHandler(async (req, res) => {
  const { q, lat, lng, radius, page, limit } = req.query;
  const shopIds = await Shop.find({
    status: "approved",
    location: { $geoWithin: { $centerSphere: [[lng, lat], radius / 6378.1] } },
  }).distinct("_id");

  const filter = { shop: { $in: shopIds }, name: { $regex: esc(q), $options: "i" } };
  const [products, total] = await Promise.all([
    Product.find(filter).sort({ popularity: -1 }).skip((page - 1) * limit).limit(limit).populate("shop", "name isOpen"),
    Product.countDocuments(filter),
  ]);
  res.json({ success: true, products: products.map(productDTO), pagination: pagination(page, limit, total) });
});

exports.productDTO = productDTO;
