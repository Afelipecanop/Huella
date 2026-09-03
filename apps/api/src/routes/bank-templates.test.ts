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
  await server.prisma.bankTemplate.deleteMany();
  await server.prisma.refreshToken.deleteMany();
  await server.prisma.user.deleteMany();
});

function templatePayload(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    bank_name: "Bancolombia",
    country: "CO",
    sender_pattern: "^alertas@bancolombia\\.com\\.co$",
    extraction_rules: [{ field: "amount", pattern: "por \\$([\\d.,]+)", group: 1 }],
    ...overrides,
  };
}

describe("POST /bank-templates", () => {
  it("crea la plantilla (recurso global, no scopeado por usuario)", async () => {
    const { accessToken } = await registerTestUser(server);
    const res = await server.inject({
      method: "POST",
      url: "/bank-templates",
      headers: authHeader(accessToken),
      payload: templatePayload(),
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().bank_name).toBe("Bancolombia");
  });
});

describe("GET /bank-templates", () => {
  it("cualquier usuario autenticado ve todas las plantillas", async () => {
    const userA = await registerTestUser(server);
    const userB = await registerTestUser(server);
    await server.inject({
      method: "POST",
      url: "/bank-templates",
      headers: authHeader(userA.accessToken),
      payload: templatePayload(),
    });

    const res = await server.inject({
      method: "GET",
      url: "/bank-templates",
      headers: authHeader(userB.accessToken),
    });
    expect(res.json()).toHaveLength(1);
  });
});

describe("PATCH /bank-templates/:id", () => {
  it("actualiza una plantilla existente", async () => {
    const { accessToken } = await registerTestUser(server);
    const created = await server.inject({
      method: "POST",
      url: "/bank-templates",
      headers: authHeader(accessToken),
      payload: templatePayload(),
    });

    const res = await server.inject({
      method: "PATCH",
      url: `/bank-templates/${created.json().id}`,
      headers: authHeader(accessToken),
      payload: { bank_name: "Bancolombia S.A." },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().bank_name).toBe("Bancolombia S.A.");
  });

  it("devuelve 404 para una plantilla inexistente", async () => {
    const { accessToken } = await registerTestUser(server);
    const res = await server.inject({
      method: "PATCH",
      url: "/bank-templates/nonexistent0000000000",
      headers: authHeader(accessToken),
      payload: { bank_name: "x" },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /bank-templates/:id", () => {
  it("borra la plantilla y una lectura posterior da 404", async () => {
    const { accessToken } = await registerTestUser(server);
    const created = await server.inject({
      method: "POST",
      url: "/bank-templates",
      headers: authHeader(accessToken),
      payload: templatePayload(),
    });

    const deleteRes = await server.inject({
      method: "DELETE",
      url: `/bank-templates/${created.json().id}`,
      headers: authHeader(accessToken),
    });
    expect(deleteRes.statusCode).toBe(204);

    const getRes = await server.inject({
      method: "GET",
      url: `/bank-templates/${created.json().id}`,
      headers: authHeader(accessToken),
    });
    expect(getRes.statusCode).toBe(404);
  });
});
