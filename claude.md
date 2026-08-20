
# Cómo quiero que trabajes

Ve fase por fase, y **espera mi confirmación antes de pasar a la siguiente**:

1. Monorepo base: pnpm workspaces, estructura de carpetas, `.gitignore`,
   `README.md` con el nombre y lema del proyecto, `LICENSE` (sugiéreme cuál
   usar para un proyecto open source de este tipo).
2. `packages/shared-types`: esquemas Zod para las 6 entidades núcleo.
3. `apps/api`: Fastify + Prisma con el `schema.prisma` completo, rutas base
   (auth, accounts, categories, transactions, webhook de ingesta de correo),
   `docker-compose.yml` con Postgres para desarrollo local.
4. `packages/bank-templates`: estructura base + una plantilla de ejemplo
   real (Bancolombia) para validar el patrón.
5. `apps/email-worker`: Worker de Cloudflare, handler de email, integración
   con `bank-templates`.
6. `apps/mobile`: Expo + Expo Router, navegación base, pantalla de entrada
   rápida de efectivo, cliente del API.
7. CI básico (GitHub Actions) + `docs/architecture.md` y
   `docs/data-model.md` documentando lo anterior.

Al final de cada fase, dime qué falta decidir o qué asumiste, para que yo lo
confirme antes de seguir.