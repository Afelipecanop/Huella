import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "../server.js";
import { registerTestUser, authHeader } from "../test/helpers.js";

let server: FastifyInstance;

beforeAll(async () => {
  server = buildServer();
  await server.ready();
});

afterAll(async () => {
  await server.close();
});

beforeEach(async () => {
  await server.prisma.ingestionEvent.deleteMany();
  await server.prisma.refreshToken.deleteMany();
  await server.prisma.user.deleteMany();
});

// apps/email-worker escribe estos eventos directo contra Prisma, sin pasar
// por la API — la única forma real de sembrar fixtures para estos tests.
async function createIngestionEvent(userId: string, overrides: Partial<Record<string, unknown>> = {}) {
  return server.prisma.ingestionEvent.create({
    data: {
      userId,
      rawContent: "correo de prueba",
      parsedOk: true,
      ...overrides,
    },
  });
}

describe("GET /ingestion-events", () => {
  it("solo devuelve los eventos del usuario autenticado", async () => {
    const userA = await registerTestUser(server);
    const userB = await registerTestUser(server);
    await createIngestionEvent(userA.userId);
    await createIngestionEvent(userB.userId);

    const res = await server.inject({
      method: "GET",
      url: "/ingestion-events",
      headers: authHeader(userA.accessToken),
    });
    expect(res.json()).toHaveLength(1);
  });
});

describe("GET /ingestion-events/:id", () => {
  it("devuelve el evento propio", async () => {
    const { accessToken, userId } = await registerTestUser(server);
    const event = await createIngestionEvent(userId, { parsedOk: false });

    const res = await server.inject({
      method: "GET",
      url: `/ingestion-events/${event.id}`,
      headers: authHeader(accessToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().parsed_ok).toBe(false);
  });

  it("devuelve 404 para el evento de otro usuario", async () => {
    const userA = await registerTestUser(server);
    const userB = await registerTestUser(server);
    const event = await createIngestionEvent(userA.userId);

    const res = await server.inject({
      method: "GET",
      url: `/ingestion-events/${event.id}`,
      headers: authHeader(userB.accessToken),
    });
    expect(res.statusCode).toBe(404);
  });
});
