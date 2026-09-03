import type { FastifyPluginAsync } from "fastify";
import { registerSchema, loginSchema, refreshRequestSchema } from "@huella/shared-types";
import { parseOrReject } from "../lib/validate.js";
import { serializeAuthTokens } from "../serializers.js";
import { hashPassword, verifyPassword } from "../lib/password.js";
import { generateRefreshToken, hashRefreshToken } from "../lib/refresh-token.js";

const INVALID_CREDENTIALS = "Credenciales inválidas";

// Rutas de registro/login/refresh/logout. Viven fuera del scope de
// requireUserPlugin (ver server.ts) porque son las que emiten la identidad,
// no las que la consumen.
const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/register", async (request, reply) => {
    const data = parseOrReject(registerSchema, request.body, reply);
    if (!data) return reply;

    const existing = await fastify.prisma.user.findUnique({ where: { email: data.email } });
    if (existing) {
      reply.code(409).send({ error: "Ya existe una cuenta con ese email" });
      return;
    }

    const passwordHash = await hashPassword(data.password);
    const user = await fastify.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        name: data.name,
        defaultCurrency: data.default_currency,
      },
    });

    const accessToken = fastify.jwt.sign({ sub: user.id });
    const refreshToken = generateRefreshToken();
    await fastify.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: refreshToken.hash, expiresAt: refreshToken.expiresAt },
    });

    reply.code(201);
    return serializeAuthTokens(user, accessToken, refreshToken.raw);
  });

  fastify.post("/login", async (request, reply) => {
    const data = parseOrReject(loginSchema, request.body, reply);
    if (!data) return reply;

    const user = await fastify.prisma.user.findUnique({ where: { email: data.email } });
    const ok = user ? await verifyPassword(user.passwordHash, data.password) : false;
    if (!user || !ok) {
      reply.code(401).send({ error: INVALID_CREDENTIALS });
      return;
    }

    const accessToken = fastify.jwt.sign({ sub: user.id });
    const refreshToken = generateRefreshToken();
    await fastify.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: refreshToken.hash, expiresAt: refreshToken.expiresAt },
    });

    return serializeAuthTokens(user, accessToken, refreshToken.raw);
  });

  fastify.post("/refresh", async (request, reply) => {
    const data = parseOrReject(refreshRequestSchema, request.body, reply);
    if (!data) return reply;

    const tokenHash = hashRefreshToken(data.refresh_token);
    const stored = await fastify.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      reply.code(401).send({ error: "Refresh token inválido o expirado" });
      return;
    }

    const newRefreshToken = generateRefreshToken();
    await fastify.prisma.$transaction([
      fastify.prisma.refreshToken.update({
        where: { id: stored.id },
        data: { revokedAt: new Date() },
      }),
      fastify.prisma.refreshToken.create({
        data: {
          userId: stored.userId,
          tokenHash: newRefreshToken.hash,
          expiresAt: newRefreshToken.expiresAt,
        },
      }),
    ]);

    const accessToken = fastify.jwt.sign({ sub: stored.user.id });
    return serializeAuthTokens(stored.user, accessToken, newRefreshToken.raw);
  });

  fastify.post("/logout", async (request, reply) => {
    const data = parseOrReject(refreshRequestSchema, request.body, reply);
    if (!data) return reply;

    const tokenHash = hashRefreshToken(data.refresh_token);
    await fastify.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    reply.code(204);
  });
};

export default authRoutes;
