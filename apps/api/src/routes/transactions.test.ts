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
  await server.prisma.category.deleteMany();
  await server.prisma.account.deleteMany();
  await server.prisma.refreshToken.deleteMany();
  await server.prisma.user.deleteMany();
});

async function createAccount(token: string, currency = "COP") {
  const res = await server.inject({
    method: "POST",
    url: "/accounts",
    headers: authHeader(token),
    payload: { name: "Efectivo", type: "cash", currency },
  });
  return res.json().id as string;
}

async function createCategory(token: string) {
  const res = await server.inject({
    method: "POST",
    url: "/categories",
    headers: authHeader(token),
    payload: { name: "Comida", type: "expense", parent_id: null },
  });
  return res.json().id as string;
}

describe("POST /transactions", () => {
  it("crea una transacción manual confirmada, con la moneda de la cuenta por default", async () => {
    const { accessToken, userId } = await registerTestUser(server);
    const accountId = await createAccount(accessToken, "COP");

    const res = await server.inject({
      method: "POST",
      url: "/transactions",
      headers: authHeader(accessToken),
      payload: { account_id: accountId, amount: -15000, date: new Date().toISOString() },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.user_id).toBe(userId);
    expect(body.source).toBe("manual");
    expect(body.status).toBe("confirmed");
    expect(body.currency).toBe("COP");
  });

  it("rechaza un account_id que no pertenece al usuario con 400", async () => {
    const userA = await registerTestUser(server);
    const userB = await registerTestUser(server);
    const accountOfA = await createAccount(userA.accessToken);

    const res = await server.inject({
      method: "POST",
      url: "/transactions",
      headers: authHeader(userB.accessToken),
      payload: { account_id: accountOfA, amount: -1000, date: new Date().toISOString() },
    });
    expect(res.statusCode).toBe(400);
  });

  it("rechaza un category_id que no pertenece al usuario con 400", async () => {
    const userA = await registerTestUser(server);
    const userB = await registerTestUser(server);
    const accountOfB = await createAccount(userB.accessToken);
    const categoryOfA = await createCategory(userA.accessToken);

    const res = await server.inject({
      method: "POST",
      url: "/transactions",
      headers: authHeader(userB.accessToken),
      payload: {
        account_id: accountOfB,
        category_id: categoryOfA,
        amount: -1000,
        date: new Date().toISOString(),
      },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /transactions/:id", () => {
  it("actualiza account_id y category_id a valores propios válidos", async () => {
    const { accessToken } = await registerTestUser(server);
    const accountId = await createAccount(accessToken);
    const otherAccountId = await createAccount(accessToken);
    const categoryId = await createCategory(accessToken);

    const created = await server.inject({
      method: "POST",
      url: "/transactions",
      headers: authHeader(accessToken),
      payload: { account_id: accountId, amount: -1000, date: new Date().toISOString() },
    });

    const res = await server.inject({
      method: "PATCH",
      url: `/transactions/${created.json().id}`,
      headers: authHeader(accessToken),
      payload: { account_id: otherAccountId, category_id: categoryId },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().account_id).toBe(otherAccountId);
    expect(res.json().category_id).toBe(categoryId);
  });

  it("rechaza mover la transacción a una cuenta de otro usuario con 400", async () => {
    const userA = await registerTestUser(server);
    const userB = await registerTestUser(server);
    const accountOfA = await createAccount(userA.accessToken);
    const accountOfB = await createAccount(userB.accessToken);

    const created = await server.inject({
      method: "POST",
      url: "/transactions",
      headers: authHeader(userA.accessToken),
      payload: { account_id: accountOfA, amount: -1000, date: new Date().toISOString() },
    });

    const res = await server.inject({
      method: "PATCH",
      url: `/transactions/${created.json().id}`,
      headers: authHeader(userA.accessToken),
      payload: { account_id: accountOfB },
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /transactions", () => {
  it("solo devuelve las transacciones del usuario autenticado", async () => {
    const userA = await registerTestUser(server);
    const userB = await registerTestUser(server);
    const accountOfA = await createAccount(userA.accessToken);
    const accountOfB = await createAccount(userB.accessToken);

    await server.inject({
      method: "POST",
      url: "/transactions",
      headers: authHeader(userA.accessToken),
      payload: { account_id: accountOfA, amount: -1000, date: new Date().toISOString() },
    });
    await server.inject({
      method: "POST",
      url: "/transactions",
      headers: authHeader(userB.accessToken),
      payload: { account_id: accountOfB, amount: -2000, date: new Date().toISOString() },
    });

    const res = await server.inject({
      method: "GET",
      url: "/transactions",
      headers: authHeader(userA.accessToken),
    });
    expect(res.json()).toHaveLength(1);
  });
});

describe("DELETE /transactions/:id", () => {
  it("borra la transacción y una lectura posterior da 404", async () => {
    const { accessToken } = await registerTestUser(server);
    const accountId = await createAccount(accessToken);
    const created = await server.inject({
      method: "POST",
      url: "/transactions",
      headers: authHeader(accessToken),
      payload: { account_id: accountId, amount: -1000, date: new Date().toISOString() },
    });

    const deleteRes = await server.inject({
      method: "DELETE",
      url: `/transactions/${created.json().id}`,
      headers: authHeader(accessToken),
    });
    expect(deleteRes.statusCode).toBe(204);

    const getRes = await server.inject({
      method: "GET",
      url: `/transactions/${created.json().id}`,
      headers: authHeader(accessToken),
    });
    expect(getRes.statusCode).toBe(404);
  });
});
