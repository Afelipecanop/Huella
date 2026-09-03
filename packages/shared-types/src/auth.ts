import { z } from "zod";
import { currencySchema } from "./common.js";
import { userSchema } from "./user.js";

export const passwordSchema = z.string().min(8).max(128);

export const registerSchema = z.object({
  email: z.string().email(),
  password: passwordSchema,
  name: z.string().min(1),
  default_currency: currencySchema,
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const refreshRequestSchema = z.object({
  refresh_token: z.string().min(1),
});

export const authTokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
  user: userSchema,
});

export type Register = z.infer<typeof registerSchema>;
export type Login = z.infer<typeof loginSchema>;
export type RefreshRequest = z.infer<typeof refreshRequestSchema>;
export type AuthTokens = z.infer<typeof authTokensSchema>;
