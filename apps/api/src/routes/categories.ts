import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { createCategorySchema, updateCategorySchema } from "@huella/shared-types";
import { parseOrReject } from "../lib/validate.js";
import { serializeCategory } from "../serializers.js";

const categoryRoutes: FastifyPluginAsync = async (fastify) => {
  async function assertParentOwnedByUser(
    parentId: string | null | undefined,
    userId: string,
    reply: FastifyReply,
  ): Promise<boolean> {
    if (!parentId) return true;
    const parent = await fastify.prisma.category.findFirst({
      where: { id: parentId, userId },
    });
    if (!parent) {
      reply.code(400).send({ error: "parent_id no corresponde a una categoría propia" });
      return false;
    }
    return true;
  }

  fastify.get("/", async (request) => {
    const categories = await fastify.prisma.category.findMany({
      where: { userId: request.userId },
      orderBy: { createdAt: "asc" },
    });
    return categories.map(serializeCategory);
  });

  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const category = await fastify.prisma.category.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });
    if (!category) {
      reply.code(404).send({ error: "Categoría no encontrada" });
      return;
    }
    return serializeCategory(category);
  });

  fastify.post("/", async (request, reply) => {
    const data = parseOrReject(createCategorySchema, request.body, reply);
    if (!data) return reply;

    if (!(await assertParentOwnedByUser(data.parent_id, request.userId, reply))) return reply;

    const category = await fastify.prisma.category.create({
      data: { ...data, userId: request.userId },
    });
    reply.code(201);
    return serializeCategory(category);
  });

  fastify.patch<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const existing = await fastify.prisma.category.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });
    if (!existing) {
      reply.code(404).send({ error: "Categoría no encontrada" });
      return;
    }

    const data = parseOrReject(updateCategorySchema, request.body, reply);
    if (!data) return reply;

    if ("parent_id" in data && data.parent_id === existing.id) {
      reply.code(400).send({ error: "Una categoría no puede ser su propio padre" });
      return;
    }
    if (!(await assertParentOwnedByUser(data.parent_id, request.userId, reply))) return reply;

    const category = await fastify.prisma.category.update({
      where: { id: existing.id },
      data,
    });
    return serializeCategory(category);
  });

  fastify.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const existing = await fastify.prisma.category.findFirst({
      where: { id: request.params.id, userId: request.userId },
    });
    if (!existing) {
      reply.code(404).send({ error: "Categoría no encontrada" });
      return;
    }

    await fastify.prisma.category.delete({ where: { id: existing.id } });
    reply.code(204);
  });
};

export default categoryRoutes;
