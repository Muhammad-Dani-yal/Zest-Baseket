const { z } = require("zod");
const { MIN_TOPUP, MAX_TOPUP } = require("../services/wallet.service");

module.exports = {
  topup: z.object({
    amount: z.number().int().min(MIN_TOPUP, `Minimum top-up is Rs. ${MIN_TOPUP}`).max(MAX_TOPUP, `Maximum top-up is Rs. ${MAX_TOPUP}`),
    provider: z.enum(["mock", "jazzcash", "easypaisa", "card"]).default("mock"),
  }),
  transactions: z.object({
    type: z.enum(["credit", "debit"]).optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  }),
};
