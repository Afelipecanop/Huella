import Fastify from "fastify";
import prismaPlugin from "./plugins/prisma.js";
import healthRoute from "./routes/health.js";
import requireUserPlugin from "./plugins/require-user.js";
import userRoutes from "./routes/users.js";
import accountRoutes from "./routes/accounts.js";
import categoryRoutes from "./routes/categories.js";
import transactionRoutes from "./routes/transactions.js";
import ingestionEventRoutes from "./routes/ingestion-events.js";
import bankTemplateRoutes from "./routes/bank-templates.js";

export function buildServer() {
  const fastify = Fastify({
    logger: true,
  });

  fastify.register(prismaPlugin);
  fastify.register(healthRoute);

  // Todo lo que cuelga de acá requiere el header x-user-id (placeholder de
  // auth); /health queda afuera de este scope a propósito.
  fastify.register(async (api) => {
    await api.register(requireUserPlugin);
    await api.register(userRoutes, { prefix: "/users" });
    await api.register(accountRoutes, { prefix: "/accounts" });
    await api.register(categoryRoutes, { prefix: "/categories" });
    await api.register(transactionRoutes, { prefix: "/transactions" });
    await api.register(ingestionEventRoutes, { prefix: "/ingestion-events" });
    await api.register(bankTemplateRoutes, { prefix: "/bank-templates" });
  });

  return fastify;
}
