import type { FastifyPluginAsync } from "fastify";
import { serializeIngestionEvent } from "../serializers.js";

// Solo lectura: apps/email-worker crea estos registros escribiendo directo
// contra Postgres (no vía esta API) — ver
// docs/superpowers/specs/2026-08-20-email-worker-design.md.
const ingestionEventRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request) => {
    const events = await fastify.prisma.ingestionEvent.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: "desc" },
    });
    return events.map(serializeIngestionEvent);
  });

  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const event = await fastify.prisma.ingestionEvent.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });
    if (!event) {
      reply.code(404).send({ error: "Evento de ingesta no encontrado" });
      return;
    }
    return serializeIngestionEvent(event);
  });
};

export default ingestionEventRoutes;
