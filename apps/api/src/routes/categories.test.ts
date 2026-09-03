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
  await server.prisma.category.deleteMany();
  await server.prisma.refreshToken.deleteMany();
  await server.prisma.user.deleteMany();
});

async function createCategory(token: string, overrides: Partial<Record<string, unknown>> = {}) {
  return server.inject({
    method: "POST",
    url: "/categories",
    headers: authHeader(token),
    payload: { name: "Comida", type: "expense", parent_id: null, ...overrides },
  });
}

describe("POST /categories", () => {
  it("crea la categoría scopeada al usuario autenticado", async () => {
    const { accessToken, userId } = await registerTestUser(server);
    const res = await createCategory(accessToken);
    expect(res.statusCode).toBe(201);
    expect(res.json().user_id).toBe(userId);
  });

  it("permite una subcategoría con parent_id propio", async () => {
    const { accessToken } = await registerTestUser(server);
    const parent = await createCategory(accessToken, { name: "Comida" });
    const res = await createCategory(accessToken, { name: "Restaurantes", parent_id: parent.json().id });
    expect(res.statusCode).toBe(201);
    expect(res.json().parent_id).toBe(parent.json().id);
  });

  it("rechaza un parent_id que pertenece a otro usuario con 400", async () => {
    const userA = await registerTestUser(server);
    const userB = await registerTestUser(server);
    const parentOfA = await createCategory(userA.accessToken);

    const res = await createCategory(userB.accessToken, { parent_id: parentOfA.json().id });
    expect(res.statusCode).toBe(400);
  });
});

describe("GET /categories", () => {
  it("solo devuelve las categorías del usuario autenticado", async () => {
    const userA = await registerTestUser(server);
    const userB = await registerTestUser(server);
    await createCategory(userA.accessToken, { name: "A" });
    await createCategory(userB.accessToken, { name: "B" });

    const res = await server.inject({
      method: "GET",
      url: "/categories",
      headers: authHeader(userA.accessToken),
    });
    expect(res.json()).toHaveLength(1);
  });
});

describe("PATCH /categories/:id", () => {
  it("actualiza parent_id a un valor propio válido", async () => {
    const { accessToken } = await registerTestUser(server);
    const parent = await createCategory(accessToken, { name: "Comida" });
    const child = await createCategory(accessToken, { name: "Suelta", parent_id: null });

    const res = await server.inject({
      method: "PATCH",
      url: `/categories/${child.json().id}`,
      headers: authHeader(accessToken),
      payload: { parent_id: parent.json().id },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().parent_id).toBe(parent.json().id);
  });

  it("rechaza que una categoría sea su propio padre con 400", async () => {
    const { accessToken } = await registerTestUser(server);
    const created = await createCategory(accessToken);
    const categoryId = created.json().id;

    const res = await server.inject({
      method: "PATCH",
      url: `/categories/${categoryId}`,
      headers: authHeader(accessToken),
      payload: { parent_id: categoryId },
    });
    expect(res.statusCode).toBe(400);
  });

  it("devuelve 404 para la categoría de otro usuario", async () => {
    const userA = await registerTestUser(server);
    const userB = await registerTestUser(server);
    const created = await createCategory(userA.accessToken);

    const res = await server.inject({
      method: "PATCH",
      url: `/categories/${created.json().id}`,
      headers: authHeader(userB.accessToken),
      payload: { name: "hackeada" },
    });
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /categories/:id", () => {
  it("borra la categoría propia", async () => {
    const { accessToken } = await registerTestUser(server);
    const created = await createCategory(accessToken);

    const res = await server.inject({
      method: "DELETE",
      url: `/categories/${created.json().id}`,
      headers: authHeader(accessToken),
    });
    expect(res.statusCode).toBe(204);
  });
});
