import { idSchema } from "@huella/shared-types";
import type { PrismaClient } from "@huella/db/workerd";

const RECIPIENT_PATTERN = /^([^@]+)@ingest\.huella\.app$/i;

export async function resolveUser(to: string, prisma: PrismaClient): Promise<string | null> {
  const match = RECIPIENT_PATTERN.exec(to);
  if (!match) return null;

  // The domain match is case-insensitive (/i), but a cuid2 id is always
  // lowercase — without this, a differently-cased local part would be
  // silently discarded here instead of resolving to a real user.
  const candidateId = match[1].toLowerCase();
  if (!idSchema.safeParse(candidateId).success) return null;

  const user = await prisma.user.findUnique({ where: { id: candidateId } });
  return user ? user.id : null;
}
