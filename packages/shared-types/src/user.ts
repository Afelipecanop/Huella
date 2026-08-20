import { z } from "zod";
import { idSchema, currencySchema, timestampSchema } from "./common.js";

export const userSchema = z.object({
  id: idSchema,
  email: z.string().email(),
  name: z.string().min(1),
  default_currency: currencySchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const createUserSchema = userSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const updateUserSchema = createUserSchema.partial();

export type User = z.infer<typeof userSchema>;
export type CreateUser = z.infer<typeof createUserSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;
