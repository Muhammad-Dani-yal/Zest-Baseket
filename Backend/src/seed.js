// Test data: node src/seed.js
// Categories, shops aur products dobara bana deta hai (users ko haath nahi lagata).
const mongoose = require("mongoose");
const env = require("./config/env");
const Category = require("./models/Category");
const Shop = require("./models/Shop");
const Product = require("./models/Product");

if (env.nodeEnv === "production") {
  console.error("Seed production mein nahi chalegi");
  process.exit(1);
}

// Centre point (default Multan). Apne shehar ke liye .env mein SEED_LAT / SEED_LNG likh sakte hain.
const LAT = Number(process.env.SEED_LAT) || 30.1575;
const LNG = Number(process.env.SEED_LNG) || 71.5249;

const CATEGORIES = [
  { name: "Grocery", slug: "grocery", icon: "grocery" },
  { name: "Fruits & Vegetables", slug: "fruits-vegetables", icon: "fruits" },
  { name: "Bakery", slug: "bakery", icon: "bakery" },
  { name: "Dairy & Eggs", slug: "dairy", icon: "dairy" },
  { name: "Meat & Chicken", slug: "meat-chicken", icon: "meat" },
  { name: "Pharmacy", slug: "pharmacy", icon: "pharmacy" },
];

// [name, price PKR, unit, section]
const PRODUCTS = {
  grocery: [
    ["Basmati Rice", 1650, "5 kg", "Staples"], ["Wheat Flour (Atta)", 1450, "10 kg", "Staples"],
    ["Sugar", 150, "1 kg", "Staples"], ["Masoor Daal", 320, "1 kg", "Staples"],
    ["Cooking Oil", 540, "1 L", "Oil & Ghee"], ["Banaspati Ghee", 480, "1 kg", "Oil & Ghee"],
    ["Tea Leaves", 330, "190 g", "Beverages"], ["Mineral Water", 90, "1.5 L", "Beverages"],
    ["Cooking Salt", 60, "800 g", "Spices"], ["Red Chilli Powder", 220, "200 g", "Spices"],
  ],
  "fruits-vegetables": [
    ["Bananas", 180, "1 dozen", "Fruits"], ["Apples", 320, "1 kg", "Fruits"], ["Oranges", 260, "1 kg", "Fruits"],
    ["Tomatoes", 120, "1 kg", "Vegetables"], ["Potatoes", 90, "1 kg", "Vegetables"],
    ["Onions", 110, "1 kg", "Vegetables"], ["Green Chillies", 40, "100 g", "Vegetables"],
    ["Fresh Coriander", 30, "1 bunch", "Herbs"], ["Mint", 30, "1 bunch", "Herbs"],
  ],
  bakery: [
    ["Sliced Bread", 150, "1 pack", "Bread"], ["Brown Bread", 190, "1 pack", "Bread"],
    ["Cake Rusk", 220, "1 pack", "Snacks"], ["Chocolate Cake", 1200, "1 lb", "Cakes"],
    ["Plain Biscuits", 90, "1 pack", "Snacks"], ["Cream Rolls", 60, "1 piece", "Snacks"],
  ],
  dairy: [
    ["Fresh Milk", 260, "1 L", "Milk"], ["Packed Milk", 290, "1 L", "Milk"],
    ["Yogurt (Dahi)", 290, "1 kg", "Yogurt"], ["Eggs", 380, "1 dozen", "Eggs"],
    ["Butter", 450, "200 g", "Butter & Cheese"], ["Cheese Slices", 520, "10 slices", "Butter & Cheese"],
  ],
  "meat-chicken": [
    ["Broiler Chicken", 520, "1 kg", "Chicken"], ["Chicken Boneless", 880, "1 kg", "Chicken"],
    ["Beef", 1400, "1 kg", "Beef"], ["Mutton", 2300, "1 kg", "Mutton"],
  ],
  pharmacy: [
    ["Hand Sanitizer", 220, "100 ml", "Hygiene"], ["Face Masks", 250, "10 pcs", "Hygiene"],
    ["Bandages", 120, "20 pcs", "First Aid"], ["Digital Thermometer", 650, "1 piece", "Devices"],
    ["Cotton Roll", 90, "100 g", "First Aid"],
  ],
};

// dLat/dLng: centre se farq (0.01 degree ~ 1.1 km)
const SHOPS = [
  { name: "Al-Madina Kiryana Store", cat: "grocery", dLat: 0.006, dLng: 0.004, area: "Gulgasht Colony", rating: 4.6, n: 128, eta: 25, min: 300 },
  { name: "Super Saver Mart", cat: "grocery", dLat: 0.002, dLng: -0.015, area: "Cantt", rating: 4.3, n: 86, eta: 30, min: 500 },
  { name: "Fresh Mandi Fruits & Veg", cat: "fruits-vegetables", dLat: -0.008, dLng: 0.010, area: "Nusrat Road", rating: 4.5, n: 64, eta: 20, min: 200 },
  { name: "Green Basket Veg", cat: "fruits-vegetables", dLat: 0.020, dLng: -0.010, area: "Bosan Road", rating: 4.1, n: 40, eta: 35, min: 150 },
  { name: "Sweet Crust Bakery", cat: "bakery", dLat: 0.012, dLng: -0.006, area: "Bosan Road", rating: 4.8, n: 210, eta: 25, min: 250 },
  { name: "Cow & Creamery Dairy", cat: "dairy", dLat: -0.004, dLng: -0.012, area: "Gulgasht Colony", rating: 4.4, n: 77, eta: 20, min: 200 },
  { name: "Chicken Point", cat: "meat-chicken", dLat: -0.014, dLng: -0.003, area: "Nusrat Road", rating: 4.2, n: 55, eta: 30, min: 400 },
  { name: "Health Plus Pharmacy", cat: "pharmacy", dLat: 0.015, dLng: 0.012, area: "Cantt", rating: 4.7, n: 150, eta: 25, min: 0 },
  { name: "Night Owl Store (closed, test)", cat: "grocery", dLat: -0.010, dLng: 0.002, area: "Cantt", rating: 4.0, n: 12, eta: 30, min: 300, isOpen: false },
  { name: "Faraway Mart (outside 3 KM, test)", cat: "grocery", dLat: 0.070, dLng: 0.050, area: "Out of range", rating: 4.0, n: 9, eta: 60, min: 300 },
];

(async () => {
  await mongoose.connect(env.mongoUri);
  await Promise.all([Category.deleteMany({}), Shop.deleteMany({}), Product.deleteMany({})]);

  const cats = await Category.insertMany(CATEGORIES.map((c, i) => ({ ...c, order: i })));
  const catId = Object.fromEntries(cats.map((c) => [c.slug, c._id]));

  let productCount = 0;
  for (const [i, s] of SHOPS.entries()) {
    const slug = s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const shop = await Shop.create({
      name: s.name,
      description: `${s.name} - test data`,
      category: catId[s.cat],
      location: { type: "Point", coordinates: [LNG + s.dLng, LAT + s.dLat] },
      address: `${s.area}, Multan (test address)`,
      phone: "+9230000000" + String(i).padStart(2, "0"),
      image: `https://picsum.photos/seed/${slug}/600/400`,
      isOpen: s.isOpen !== false,
      openingHours: "09:00 - 22:00",
      rating: s.rating,
      ratingCount: s.n,
      deliveryTimeMin: s.eta,
      minOrder: s.min,
      status: "approved",
    });
    const items = PRODUCTS[s.cat].map(([name, price, unit, section], j) => ({
      shop: shop._id,
      name,
      price: price + ((i * 7 + j * 3) % 5) * 5, // har shop ki thori alag price
      unit,
      section,
      description: `${name} (${unit})`,
      image: `https://picsum.photos/seed/${slug}-${j}/400/400`,
      stock: j % 7 === 6 ? 0 : 10 + ((i + j) % 5) * 10, // koi koi product out of stock
      popularity: (i * 13 + j * 17) % 100,
    }));
    await Product.insertMany(items);
    productCount += items.length;
  }

  await Shop.init(); // 2dsphere index ban jaye
  console.log(`Seed done: ${cats.length} categories, ${SHOPS.length} shops, ${productCount} products`);
  console.log(`Centre: lat ${LAT}, lng ${LNG}`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error("Seed failed:", e.message);
  process.exit(1);
});
