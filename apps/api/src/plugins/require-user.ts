import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";

// La identidad del usuario viaja en un JWT de acceso (ver plugins/jwt.ts),
// firmado en /auth/login y /auth/register. Va envuelto en fastify-plugin
// para que el hook se adjunte al scope donde se registra (el sub-árbol
// "api" en server.ts) en vez de crear su propio contexto aislado — si no,
// Fastify lo encapsula y el hook nunca llega a las rutas hermanas
// registradas a continuación. Se registra un nivel por debajo de la raíz
// a propósito, para que /health y /auth queden afuera de este scope.
export default fp(async function requireUserPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest("userId", "");

  fastify.addHook("onRequest", async (request, reply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : undefined;

    if (!token) {
      reply.code(401).send({ error: "Falta o es inválido el header Authorization" });
      return reply;
    }

    try {
      const payload = fastify.jwt.verify<{ sub: string }>(token);
      request.userId = payload.sub;
    } catch {
      reply.code(401).send({ error: "Falta o es inválido el header Authorization" });
      return reply;
    }
  });
});
