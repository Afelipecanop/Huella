import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestPrisma } from "./testPrisma";
import { resolveUser } from "../src/resolveUser";

const prisma = createTestPrisma();
let userId: string;

beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      email: `resolve-user-${Date.now()}@example.com`,
      name: "Test User",
      defaultCurrency: "COP",
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("resolveUser", () => {
  it("resolves the user_id when the recipient matches an existing user", async () => {
    const result = await resolveUser(`${userId}@ingest.huella.app`, prisma);
    expect(result).toBe(userId);
  });

  it("returns null when the recipient's local part isn't a valid cuid", async () => {
    const result = await resolveUser("not-a-cuid@ingest.huella.app", prisma);
    expect(result).toBeNull();
  });

  it("returns null when the recipient domain doesn't match", async () => {
    const result = await resolveUser(`${userId}@other-domain.com`, prisma);
    expect(result).toBeNull();
  });

  it("returns null when the cuid is well-formed but no user exists with that id", async () => {
    const result = await resolveUser("u10cj1c94sj9o76bqbd4wam1@ingest.huella.app", prisma);
    expect(result).toBeNull();
  });
});
