const { z } = require("zod");
const { SERVICE_RADIUS_KM } = require("../utils/geo");

const lat = z.coerce.number({ invalid_type_error: "lat (latitude) is required" }).min(-90).max(90);
const lng = z.coerce.number({ invalid_type_error: "lng (longitude) is required" }).min(-180).max(180);
const page = z.coerce.number().int().min(1).default(1);
const limit = z.coerce.number().int().min(1).max(50).default(20);
const radius = z.coerce.number().positive().max(SERVICE_RADIUS_KM).default(SERVICE_RADIUS_KM);

module.exports = {
  home: z.object({ lat, lng }),
  shops: z.object({
    lat,
    lng,
    radius,
    category: z.string().trim().max(60).optional(), // slug ya id
    q: z.string().trim().max(50).optional(),
    sort: z.enum(["distance", "rating"]).default("distance"),
    openNow: z.enum(["true", "false"]).optional(),
    page,
    limit,
  }),
  shopDetails: z.object({ lat: lat.optional(), lng: lng.optional() }),
  shopProducts: z.object({
    section: z.string().trim().max(60).optional(),
    q: z.string().trim().max(50).optional(),
    page,
    limit,
  }),
  searchProducts: z.object({ q: z.string().trim().min(2).max(50), lat, lng, radius, page, limit }),
};
