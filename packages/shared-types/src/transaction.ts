import { z } from "zod";
import { idSchema, currencySchema, timestampSchema, amountSchema } from "./common.js";

export const transactionSourceSchema = z.enum(["manual", "email"]);
export const transactionStatusSchema = z.enum(["pending", "confirmed"]);

export const transactionSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  account_id: idSchema,
  category_id: idSchema.nullable(),
  amount: amountSchema,
  currency: currencySchema,
  merchant: z.string().min(1).nullable(),
  date: timestampSchema,
  source: transactionSourceSchema,
  status: transactionStatusSchema,
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

// Payload genérico de creación de transacción (uso interno de la API).
// source y status los asigna el backend según el flujo de creación, no el
// cliente. apps/email-worker no usa este schema: escribe directo contra
// Prisma, sin pasar por la API.
export const createTransactionSchema = transactionSchema.omit({
  id: true,
  user_id: true,
  source: true,
  status: true,
  created_at: true,
  updated_at: true,
});

// Entrada manual de efectivo: debe sentirse instantánea, así que solo
// amount, date y account_id son obligatorios.
export const createManualTransactionSchema = z.object({
  account_id: idSchema,
  amount: amountSchema,
  date: timestampSchema,
  category_id: idSchema.nullable().optional(),
  merchant: z.string().min(1).nullable().optional(),
  currency: currencySchema.optional(),
});

export const updateTransactionSchema = transactionSchema
  .omit({ id: true, user_id: true, source: true, created_at: true, updated_at: true })
  .partial();

export type TransactionSource = z.infer<typeof transactionSourceSchema>;
export type TransactionStatus = z.infer<typeof transactionStatusSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type CreateTransaction = z.infer<typeof createTransactionSchema>;
export type CreateManualTransaction = z.infer<typeof createManualTransactionSchema>;
export type UpdateTransaction = z.infer<typeof updateTransactionSchema>;
