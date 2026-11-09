const { z } = require("zod");
const { objectId } = require("./cart.schema");

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);

module.exports = {
  quote: z.object({ addressId: objectId.optional() }),
  create: z.object({
    addressId: objectId.optional(),
    paymentMethod: z.enum(["cod", "wallet", "online"]),
    note: z.string().trim().max(200).optional(),
  }),
  address: z.object({
    label: z.string().trim().min(1).max(30).default("Home"),
    line1: z.string().trim().min(5, "Enter a complete address").max(200),
    city: z.string().trim().min(2).max(60),
    phone: z.string().trim().max(20).optional(),
    lat,
    lng,
    isDefault: z.boolean().optional(),
  }),
  addressUpdate: z
    .object({
      label: z.string().trim().min(1).max(30),
      line1: z.string().trim().min(5).max(200),
      city: z.string().trim().min(2).max(60),
      phone: z.string().trim().max(20),
      lat,
      lng,
      isDefault: z.boolean(),
    })
    .partial(),
};

const { z: zz } = require("zod");
const pageN = zz.coerce.number().int().min(1).default(1);
const limitN = zz.coerce.number().int().min(1).max(50).default(10);
const four = zz.string().regex(/^\d{4}$/, "Code must be 4 digits");

module.exports.list = zz.object({
  status: zz.enum(["active", "past", "placed", "preparing", "ready_for_pickup", "out_for_delivery", "delivered", "cancelled"]).optional(),
  page: pageN,
  limit: limitN,
});
module.exports.cancel = zz.object({ reason: zz.string().trim().max(200).optional() });
module.exports.pickup = zz.object({ code: four });
module.exports.deliver = zz.object({ otp: four });
module.exports.devRole = zz.object({ role: zz.enum(["customer", "rider"]) });
