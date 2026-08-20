import type { FastifyPluginAsync } from "fastify";

const healthRoute: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async (_request, reply) => {
    let db: "connected" | "unreachable" = "unreachable";
    try {
      await fastify.prisma.$queryRaw`SELECT 1`;
      db = "connected";
    } catch {
      db = "unreachable";
    }

    reply.code(db === "connected" ? 200 : 503);
    return { status: "ok", db, uptime: process.uptime() };
  });
};

export default healthRoute;
