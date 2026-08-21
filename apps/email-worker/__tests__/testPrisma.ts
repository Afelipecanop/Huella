import { env } from "cloudflare:test";
import { PrismaClient } from "@huella/db/workerd";
import { PrismaPg } from "@prisma/adapter-pg";

export function createTestPrisma() {
  const adapter = new PrismaPg({ connectionString: env.HYPERDRIVE.connectionString });
  return new PrismaClient({ adapter });
}
