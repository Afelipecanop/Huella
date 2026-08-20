import type { FastifyPluginAsync } from "fastify";
import { createBankTemplateSchema, updateBankTemplateSchema } from "@huella/shared-types";
import { parseOrReject } from "../lib/validate.js";
import { serializeBankTemplate } from "../serializers.js";

// Recurso global, no scoped por usuario: pensado para que la comunidad
// agregue bancos nuevos. Igual queda detrás del placeholder de auth por
// simplicidad hasta que exista un rol/permiso real de "mantenedor".
const bankTemplateRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/", async () => {
    const templates = await fastify.prisma.bankTemplate.findMany({
      orderBy: { bankName: "asc" },
    });
    return templates.map(serializeBankTemplate);
  });

  fastify.get<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const template = await fastify.prisma.bankTemplate.findUnique({
      where: { id: request.params.id },
    });
    if (!template) {
      reply.code(404).send({ error: "Plantilla no encontrada" });
      return;
    }
    return serializeBankTemplate(template);
  });

  fastify.post("/", async (request, reply) => {
    const data = parseOrReject(createBankTemplateSchema, request.body, reply);
    if (!data) return reply;

    const template = await fastify.prisma.bankTemplate.create({
      data: {
        bankName: data.bank_name,
        country: data.country,
        senderPattern: data.sender_pattern,
        extractionRules: data.extraction_rules,
      },
    });
    reply.code(201);
    return serializeBankTemplate(template);
  });

  fastify.patch<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const existing = await fastify.prisma.bankTemplate.findUnique({
      where: { id: request.params.id },
    });
    if (!existing) {
      reply.code(404).send({ error: "Plantilla no encontrada" });
      return;
    }

    const data = parseOrReject(updateBankTemplateSchema, request.body, reply);
    if (!data) return reply;

    const template = await fastify.prisma.bankTemplate.update({
      where: { id: existing.id },
      data: {
        ...(data.bank_name !== undefined && { bankName: data.bank_name }),
        ...(data.country !== undefined && { country: data.country }),
        ...(data.sender_pattern !== undefined && { senderPattern: data.sender_pattern }),
        ...(data.extraction_rules !== undefined && { extractionRules: data.extraction_rules }),
      },
    });
    return serializeBankTemplate(template);
  });

  fastify.delete<{ Params: { id: string } }>("/:id", async (request, reply) => {
    const existing = await fastify.prisma.bankTemplate.findUnique({
      where: { id: request.params.id },
    });
    if (!existing) {
      reply.code(404).send({ error: "Plantilla no encontrada" });
      return;
    }

    await fastify.prisma.bankTemplate.delete({ where: { id: existing.id } });
    reply.code(204);
  });
};

export default bankTemplateRoutes;
