const { z } = require("zod");

module.exports = {
  send: z.object({ text: z.string().trim().min(1, "Message is empty").max(500, "Message is too long") }),
  history: z.object({
    before: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(50).default(30),
  }),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    heading: z.number().min(0).max(360).optional(),
  }),
};
