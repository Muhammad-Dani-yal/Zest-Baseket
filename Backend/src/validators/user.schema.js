const { z } = require("zod");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72)
  .regex(/[A-Za-z]/, "Password needs a letter")
  .regex(/\d/, "Password needs a number");

module.exports = {
  updateProfile: z
    .object({
      name: z.string().trim().min(2).max(80),
      email: z.string().trim().toLowerCase().email().nullable(), // null = email hata do
    })
    .partial()
    .refine((o) => Object.keys(o).length > 0, "Nothing to update"),
  changePassword: z.object({ currentPassword: z.string().min(1), newPassword: password }),
  pushToken: z.object({ token: z.string().min(10).max(300).nullable() }),
  deleteAccount: z.object({ password: z.string().min(1) }),
};
