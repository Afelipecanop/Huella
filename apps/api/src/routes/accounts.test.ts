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
  await server.prisma.transaction.deleteMany();
  await server.prisma.account.deleteMany();
  await server.prisma.bankTemplate.deleteMany();
  await server.prisma.refreshToken.deleteMany();
  await server.prisma.user.deleteMany();
});

async function createAccount(token: string, overrides: Partial<Record<string, unknown>> = {}) {
  return server.inject({
    method: "POST",
    url: "/accounts",
    headers: authHeader(token),
    payload: { name: "Efectivo", type: "cash", currency: "COP", ...overrides },
  });
}

describe("POST /accounts", () => {
  it("crea la cuenta scopeada al usuario autenticado", async () => {
    const { accessToken, userId } = await registerTestUser(server);
    const res = await createAccount(accessToken);
    expect(res.statusCode).toBe(201);
    expect(res.json().user_id).toBe(userId);
  });

  it("rechaza un bank_template_id que no existe con 400", async () => {
    const { accessToken } = await registerTestUser(server);
    const res = await createAccount(accessToken, { type: "bank", bank_template_id: "nope123456789012345" });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /accounts", () => {
  it("solo devuelve las cuentas del usuario autenticado", async () => {
    const userA = await registerTestUser(server);
    const userB = await registerTestUser(server);
    await createAccount(userA.accessToken, { name: "Cuenta A" });
    await createAccount(userB.accessToken, { name: "Cuenta B" });

    const res = await server.inject({ method: "GET", url: "/accounts", headers: authHeader(userA.accessToken) });
    const accounts = res.json();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].name).toBe("Cuenta A");
  });
});

describe("GET /accounts/:id", () => {
  it("devuelve 404 para la cuenta de otro usuario", async () => {
    const userA = await registerTestUser(server);
    const userB = await registerTestUser(server);
    const created = await createAccount(userA.accessToken);
    const accountId = created.json().id;

    const res = await server.inject({
      method: "GET",
      url: `/accounts/${accountId}`,
      headers: authHeader(userB.accessToken),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("PATCH /accounts/:id", () => {
  it("actualiza una cuenta propia", async () => {
    const { accessToken } = await registerTestUser(server);
    const created = await createAccount(accessToken);
    const accountId = created.json().id;

    const res = await server.inject({
      method: "PATCH",
      url: `/accounts/${accountId}`,
      headers: authHeader(accessToken),
      payload: { name: "Efectivo renombrado" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Efectivo renombrado");
  });

  it("devuelve 404 al intentar actualizar la cuenta de otro usuario", async () => {
    const userA = await registerTestUser(server);
    const userB = await registerTestUser(server);
    const created = await createAccount(userA.accessToken);
    const accountId = created.json().id;

    const res = await server.inject({
      method: "PATCH",
      url: `/accounts/${accountId}`,
      headers: authHeader(userB.accessToken),
      payload: { name: "hackeada" },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /accounts/:id", () => {
  it("borra la cuenta y una lectura posterior da 404", async () => {
    const { accessToken } = await registerTestUser(server);
    const created = await createAccount(accessToken);
    const accountId = created.json().id;

    const deleteRes = await server.inject({
      method: "DELETE",
      url: `/accounts/${accountId}`,
      headers: authHeader(accessToken),
    });
    expect(deleteRes.statusCode).toBe(204);

    const getRes = await server.inject({
      method: "GET",
      url: `/accounts/${accountId}`,
      headers: authHeader(accessToken),
    });
    expect(getRes.statusCode).toBe(404);
  });
});
