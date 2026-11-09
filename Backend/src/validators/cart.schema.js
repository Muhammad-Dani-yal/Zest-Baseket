const { z } = require("zod");
const mongoose = require("mongoose");
const pricing = require("../config/pricing");

const objectId = z.string().refine((v) => mongoose.isValidObjectId(v), "Invalid id");
const qty = z.number().int().min(1).max(pricing.maxQtyPerItem);

module.exports = {
  addItem: z.object({ productId: objectId, qty: qty.default(1) }),
  updateItem: z.object({ qty }),
  objectId,
};
