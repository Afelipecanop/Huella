import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";

// Campo de la transacción que una regla de extracción produce.
export const extractionFieldSchema = z.enum(["amount", "merchant", "date", "currency"]);

// Una regla = un regex aplicado al cuerpo del correo (o a un selector, para
// correos HTML) y el grupo de captura que contiene el valor del campo.
// Este shape es un primer borrador: se ajustará cuando construyamos el
// parser real en apps/email-worker.
export const extractionRuleSchema = z.object({
  field: extractionFieldSchema,
  pattern: z.string(), // regex como string
  group: z.number().int().min(0).default(1),
});

export const bankTemplateSchema = z.object({
  id: idSchema,
  bank_name: z.string().min(1),
  country: z.string().regex(/^[A-Z]{2}$/, "Debe ser un código de país ISO 3166-1 alpha-2"),
  sender_pattern: z.string(), // regex contra el remitente del correo
  extraction_rules: z.array(extractionRuleSchema),
  created_at: timestampSchema,
  updated_at: timestampSchema,
});

export const createBankTemplateSchema = bankTemplateSchema.omit({
  id: true,
  created_at: true,
  updated_at: true,
});

export const updateBankTemplateSchema = createBankTemplateSchema.partial();

export type ExtractionField = z.infer<typeof extractionFieldSchema>;
export type ExtractionRule = z.infer<typeof extractionRuleSchema>;
export type BankTemplate = z.infer<typeof bankTemplateSchema>;
export type CreateBankTemplate = z.infer<typeof createBankTemplateSchema>;
export type UpdateBankTemplate = z.infer<typeof updateBankTemplateSchema>;
