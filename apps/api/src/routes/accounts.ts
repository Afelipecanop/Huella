import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { createAccountSchema, updateAccountSchema } from "@huella/shared-types";
import { parseOrReject } from "../lib/validate.js";
import { serializeAccount } from "../serializers.js";

const accountRoutes: FastifyPluginAsync = async (fastify) => {
  async function assertBankTemplateExists(
    bankTemplateId: string | null | undefined,
    reply: FastifyReply,
  ): Promise<boolean> {
    if (!bankTemplateId) return true;
    const template = await fastify.prisma.bankTemplate.findUnique({ where: { id: bankTemplateId } });
    if (!template) {
      reply.code(400).send({ error: "bank_template_id no corresponde a una plantilla existente" });
      return false;
    }
    return true;
  }

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

    if (!(await assertBankTemplateExists(data.bank_template_id, reply))) return reply;

    const account = await fastify.prisma.account.create({
      data: {
        userId: request.userId,
        name: data.name,
        type: data.type,
        currency: data.currency,
        bankTemplateId: data.bank_template_id ?? null,
      },
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

    if (!(await assertBankTemplateExists(data.bank_template_id, reply))) return reply;

    const account = await fastify.prisma.account.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined && { name: data.name }),
        ...(data.type !== undefined && { type: data.type }),
        ...(data.currency !== undefined && { currency: data.currency }),
        ...(data.bank_template_id !== undefined && { bankTemplateId: data.bank_template_id }),
      },
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
