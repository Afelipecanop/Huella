import fp from "fastify-plugin";
import { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";

export default fp(async function prismaPlugin(fastify: FastifyInstance) {
  const prisma = new PrismaClient();

  // No bloqueamos el arranque si la DB no está disponible todavía
  // (ej. en desarrollo antes de levantar docker compose); /health lo refleja.
  await prisma.$connect().catch((err: unknown) => {
    fastify.log.warn({ err }, "No se pudo conectar a la base de datos al iniciar");
  });

  fastify.decorate("prisma", prisma);

  fastify.addHook("onClose", async (instance) => {
    await instance.prisma.$disconnect();
  });
});
