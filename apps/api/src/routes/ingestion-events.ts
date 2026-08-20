import type { FastifyPluginAsync } from "fastify";
import { serializeIngestionEvent } from "../serializers.js";

// Solo lectura: la creación (via el webhook del email-worker) y el enlace a
// transaction_id se resuelven en la fase de apps/email-worker, no acá.
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
