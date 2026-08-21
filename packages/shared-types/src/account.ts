import { z } from "zod";
import { idSchema, currencySchema, timestampSchema } from "./common.js";

export const accountTypeSchema = z.enum(["bank", "cash", "wallet"]);

export const accountSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  name: z.string().min(1),
  type: accountTypeSchema,
  currency: currencySchema,
  bank_template_id: idSchema.nullable(),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

// user_id no viaja en el payload: lo determina el backend a partir de la
// identidad autenticada (header x-user-id por ahora, JWT más adelante).
// bank_template_id es opcional en creación/actualización: por default una
// cuenta no está vinculada a ninguna plantilla de banco.
export const createAccountSchema = accountSchema
  .omit({
    id: true,
    user_id: true,
    created_at: true,
    updated_at: true,
  })
  .extend({
    bank_template_id: idSchema.nullable().optional(),
  });

export const updateAccountSchema = createAccountSchema.partial();

export type AccountType = z.infer<typeof accountTypeSchema>;
export type Account = z.infer<typeof accountSchema>;
export type CreateAccount = z.infer<typeof createAccountSchema>;
export type UpdateAccount = z.infer<typeof updateAccountSchema>;
