import type { ForwardableEmailMessage } from "@cloudflare/workers-types";
import { PrismaClient } from "@huella/db/workerd";
import { PrismaPg } from "@prisma/adapter-pg";
import type { Env } from "./env";
import { resolveUser } from "./resolveUser";
import { parseEmail } from "./parseEmail";
import { processEmail } from "./processEmail";

export default {
  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext): Promise<void> {
    void ctx;
    const adapter = new PrismaPg({ connectionString: env.HYPERDRIVE.connectionString });
    const prisma = new PrismaClient({ adapter });

    try {
      const userId = await resolveUser(message.to, prisma);
      if (!userId) return;

      const { from, text } = await parseEmail(message.raw);
      await processEmail(prisma, { userId, from, text });
    } finally {
      await prisma.$disconnect();
    }
  },
};
