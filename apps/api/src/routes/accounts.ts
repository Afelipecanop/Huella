import type { FastifyPluginAsync } from "fastify";
import { createAccountSchema, updateAccountSchema } from "@huella/shared-types";
import { parseOrReject } from "../lib/validate.js";
import { serializeAccount } from "../serializers.js";

const accountRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async (request) => {
    const accounts = await fastify.prisma.account.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: "asc" },
    });
    return accounts.map(serializeAccount);
  });

  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const account = await fastify.prisma.account.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });
    if (!account) {
      reply.code(404).send({ error: "Cuenta no encontrada" });
      return;
    }
    return serializeAccount(account);
  });

  fastify.post("/", async (request, reply) => {
    const data = parseOrReject(createAccountSchema, request.body, reply);
    if (!data) return reply;

    const account = await fastify.prisma.account.create({
      data: { ...data, userId: request.userId },
    });
    reply.code(201);
    return serializeAccount(account);
  });

  fastify.patch<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const existing = await fastify.prisma.account.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });
    if (!existing) {
      reply.code(404).send({ error: "Cuenta no encontrada" });
      return;
    }

    const data = parseOrReject(updateAccountSchema, request.body, reply);
    if (!data) return reply;

    const account = await fastify.prisma.account.update({
      where: { id: existing.id },
      data,
    });
    return serializeAccount(account);
  });

  fastify.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const existing = await fastify.prisma.account.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });
    if (!existing) {
      reply.code(404).send({ error: "Cuenta no encontrada" });
      return;
    }

    await fastify.prisma.account.delete({ where: { id: existing.id } });
    reply.code(204);
  });
};

export default accountRoutes;
