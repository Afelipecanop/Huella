import { z } from "zod";
import { idSchema, timestampSchema } from "./common.js";

// Registro crudo e inmutable de cada correo recibido, se cree o no la
// transacción. Por eso no tiene updated_at: nunca se edita, solo se enlaza
// a una transacción cuando el parseo tuvo éxito y esta se crea.
export const ingestionEventSchema = z.object({
  id: idSchema,
  user_id: idSchema,
  template_id: idSchema.nullable(), // null si ninguna plantilla matcheó el remitente
  transaction_id: idSchema.nullable(),
  raw_content: z.string(),
  parsed_ok: z.boolean(),
  created_at: timestampSchema,
});

// Lo que envía el email-worker tras intentar parsear el correo.
// transaction_id no viaja acá: lo asigna el backend si decide crear la transacción.
export const createIngestionEventSchema = ingestionEventSchema.omit({
  id: true,
  transaction_id: true,
  created_at: true,
});

// Único "update" válido sobre un evento de ingesta: enlazarlo a la
// transacción que terminó creándose (manual o automáticamente).
export const linkIngestionEventTransactionSchema = z.object({
  transaction_id: idSchema,
});

export type IngestionEvent = z.infer<typeof ingestionEventSchema>;
export type CreateIngestionEvent = z.infer<typeof createIngestionEventSchema>;
export type LinkIngestionEventTransaction = z.infer<typeof linkIngestionEventTransactionSchema>;
