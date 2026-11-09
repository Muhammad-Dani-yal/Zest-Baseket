const { z } = require("zod");
const { normalizePhone } = require("../utils/phone");

const phone = z.string().transform((v, ctx) => {
  const n = normalizePhone(v);
  if (!n) {
    ctx.addIssue({ code: "custom", message: "Enter a valid Pakistani mobile number" });
    return z.NEVER;
  }
  return n;
});

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72)
  .regex(/[A-Za-z]/, "Password needs a letter")
  .regex(/\d/, "Password needs a number");

const code = z.string().regex(/^\d{6}$/, "OTP must be 6 digits");

module.exports = {
  signup: z.object({
    name: z.string().trim().min(2).max(80),
    phone,
    email: z.string().email().optional(),
    password,
  }),
  login: z.object({ phone, password: z.string().min(1) }),
  sendOtp: z.object({ phone, purpose: z.enum(["signup", "login"]) }),
  verifyOtp: z.object({ phone, code, purpose: z.enum(["signup", "login"]) }),
  forgot: z.object({ phone }),
  verifyReset: z.object({ phone, code }),
  reset: z.object({ resetToken: z.string().min(10), newPassword: password }),
  refresh: z.object({ refreshToken: z.string().min(10) }),
};
