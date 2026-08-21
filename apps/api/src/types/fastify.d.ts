import type { PrismaClient } from "@huella/db";

declare module "fastify" {
  interface FastifyInstance {
    prisma: PrismaClient;
  }

  interface FastifyRequest {
    userId: string;
  }
}
