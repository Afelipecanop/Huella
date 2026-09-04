import type { ForwardableEmailMessage } from "@cloudflare/workers-types";
import { PrismaClient } from "@huella/db/workerd";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Env } from "./env";
import { resolveUser } from "./resolveUser";
import { parseEmail } from "./parseEmail";
import { processEmail } from "./processEmail";
import { persistIngestion } from "./persist";

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    void ctx;
    const adapter = new PrismaPg({ connectionString: env.HYPERDRIVE.connectionString });
    const prisma = new PrismaClient({ adapter });

    try {
      const userId = await resolveUser(message.to, prisma);
      if (!userId) return;

      const { from, text, messageId } = await parseEmail(message.raw);

      // No es la garantía de corrección (esa es la unique constraint en
      // IngestionEvent.messageId, ver persist.ts) — es para no repetir
      // trabajo (matching de plantilla, lookups de cuenta) en el caso común
      // de un reintento secuencial de Cloudflare del mismo correo.
      if (messageId) {
        const existing = await prisma.ingestionEvent.findUnique({ where: { messageId } });
        if (existing) return;
      }

      try {
        await processEmail(prisma, { userId, from, text, messageId });
      } catch {
        // A malformed BankTemplate row (bad regex, non-array extraction_rules)
        // or any other unexpected failure must never lose the email — persist
        // the same fallback shape processEmail's own failure branches use.
        await persistIngestion(prisma, {
          userId,
          templateId: null,
          rawContent: text,
          messageId,
          transaction: null,
        }).catch(() => {});
      }
    } finally {
      await prisma.$disconnect();
    }
  },
};
