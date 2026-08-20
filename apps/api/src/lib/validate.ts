import type { FastifyReply } from "fastify";
import type { z } from "zod";

// Valida `data` contra `schema`; si falla, ya deja la respuesta 400 enviada
// y devuelve undefined para que el handler corte (`if (!data) return reply`).
export function parseOrReject<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown,
  reply: FastifyReply,
): z.infer<T> | undefined {
  const result = schema.safeParse(data);
  if (!result.success) {
    reply.code(400).send({ error: "Datos inválidos", issues: result.error.issues });
    return undefined;
  }
  return result.data;
}
