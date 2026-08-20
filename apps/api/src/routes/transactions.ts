import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { createManualTransactionSchema, updateTransactionSchema } from "@huella/shared-types";
import { parseOrReject } from "../lib/validate.js";
import { serializeTransaction } from "../serializers.js";

const transactionRoutes: FastifyPluginAsync = async (fastify) => {
  async function findOwnedAccount(accountId: string, userId: string) {
    return fastify.prisma.account.findFirst({ where: { id: accountId, userId } });
  }

  async function assertCategoryOwnedByUser(
    categoryId: string | null | undefined,
    userId: string,
    reply: FastifyReply,
  ): Promise<boolean> {
    if (!categoryId) return true;
    const category = await fastify.prisma.category.findFirst({
      where: { id: categoryId, userId },
    });
    if (!category) {
      reply.code(400).send({ error: "category_id no corresponde a una categoría propia" });
      return false;
    }
    return true;
  }

  fastify.get("/", async (request) => {
    const transactions = await fastify.prisma.transaction.findMany({
      where: { userId: request.userId },
      orderBy: { date: "desc" },
    });
    return transactions.map(serializeTransaction);
  });

  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const transaction = await fastify.prisma.transaction.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });
    if (!transaction) {
      reply.code(404).send({ error: "Transacción no encontrada" });
      return;
    }
    return serializeTransaction(transaction);
  });

  // Entrada manual de efectivo/gasto: el único create expuesto por ahora.
  // La creación vía correo la hace el email-worker en su propia fase,
  // directo contra la DB (source: "email"), no a través de este endpoint.
  fastify.post("/", async (request, reply) => {
    const data = parseOrReject(createManualTransactionSchema, request.body, reply);
    if (!data) return reply;

    const account = await findOwnedAccount(data.account_id, request.userId);
    if (!account) {
      reply.code(400).send({ error: "account_id no corresponde a una cuenta propia" });
      return;
    }
    if (!(await assertCategoryOwnedByUser(data.category_id, request.userId, reply))) return reply;

    const transaction = await fastify.prisma.transaction.create({
      data: {
        userId: request.userId,
        accountId: data.account_id,
        categoryId: data.category_id ?? null,
        amount: data.amount,
        currency: data.currency ?? account.currency,
        merchant: data.merchant ?? null,
        date: data.date,
        source: "manual",
        status: "confirmed",
      },
    });
    reply.code(201);
    return serializeTransaction(transaction);
  });

  fastify.patch<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const existing = await fastify.prisma.transaction.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });
    if (!existing) {
      reply.code(404).send({ error: "Transacción no encontrada" });
      return;
    }

    const data = parseOrReject(updateTransactionSchema, request.body, reply);
    if (!data) return reply;

    if (data.account_id && !(await findOwnedAccount(data.account_id, request.userId))) {
      reply.code(400).send({ error: "account_id no corresponde a una cuenta propia" });
      return;
    }
    if (!(await assertCategoryOwnedByUser(data.category_id, request.userId, reply))) return reply;

    const transaction = await fastify.prisma.transaction.update({
      where: { id: existing.id },
      data,
    });
    return serializeTransaction(transaction);
  });

  fastify.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const existing = await fastify.prisma.transaction.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });
    if (!existing) {
      reply.code(404).send({ error: "Transacción no encontrada" });
      return;
    }

    await fastify.prisma.transaction.delete({ where: { id: existing.id } });
    reply.code(204);
  });
};

export default transactionRoutes;
