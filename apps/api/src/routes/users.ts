import type { FastifyPluginAsync } from "fastify";
import { updateUserSchema } from "@huella/shared-types";
import { parseOrReject } from "../lib/validate.js";
import { serializeUser } from "../serializers.js";

// Solo get/update sobre el propio usuario: crear un usuario es "signup",
// eso vive en la fase de autenticación, no acá.
const userRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/me", async (request, reply) => {
    const user = await fastify.prisma.user.findUnique({ where: { id: request.userId } });
    if (!user) {
      reply.code(404).send({ error: "Usuario no encontrado" });
      return;
    }
    return serializeUser(user);
  });

  fastify.patch("/me", async (request, reply) => {
    const existing = await fastify.prisma.user.findUnique({ where: { id: request.userId } });
    if (!existing) {
      reply.code(404).send({ error: "Usuario no encontrado" });
      return;
    }

    const data = parseOrReject(updateUserSchema, request.body, reply);
    if (!data) return reply;

    const user = await fastify.prisma.user.update({
      where: { id: existing.id },
      data: {
        ...(data.email !== undefined && { email: data.email }),
        ...(data.name !== undefined && { name: data.name }),
        ...(data.default_currency !== undefined && { defaultCurrency: data.default_currency }),
      },
    });
    return serializeUser(user);
  });
};

export default userRoutes;
