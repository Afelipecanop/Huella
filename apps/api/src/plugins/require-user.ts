import fp from "fastify-plugin";
import type { FastifyInstance } from "fastify";
import { idSchema } from "@huella/shared-types";

// Placeholder de autenticación: hasta que exista JWT/sesiones, la identidad
// del usuario viaja en el header x-user-id. Va envuelto en fastify-plugin
// para que el hook se adjunte al scope donde se registra (el sub-árbol
// "api" en server.ts) en vez de crear su propio contexto aislado — si no,
// Fastify lo encapsula y el hook nunca llega a las rutas hermanas
// registradas a continuación. Se registra un nivel por debajo de la raíz
// a propósito, para que /health quede afuera de este scope.
export default fp(async function requireUserPlugin(fastify: FastifyInstance) {
  fastify.decorateRequest("userId", "");

  fastify.addHook("onRequest", async (request, reply) => {
    const header = request.headers["x-user-id"];
    const value = Array.isArray(header) ? header[0] : header;
    const parsed = idSchema.safeParse(value);

    if (!parsed.success) {
      reply.code(401).send({ error: "Falta o es inválido el header x-user-id" });
      return reply;
    }

    request.userId = parsed.data;
  });
});
