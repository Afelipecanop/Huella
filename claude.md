
# Cómo quiero que trabajes

## Dónde vamos

El plan original de 7 fases ya está mayormente ejecutado:

1. ✅ Monorepo base (pnpm workspaces)
2. ✅ `packages/shared-types` (esquemas Zod de las 6 entidades núcleo)
3. ✅ `apps/api` (Fastify + Prisma, CRUD completo, `docker-compose.yml`)
4. ✅ `packages/bank-templates` (motor de parseo + plantilla Bancolombia)
5. ✅ `apps/email-worker` (Cloudflare Email Worker + `packages/db` compartido)
   — implementación completa vía subagent-driven-development en worktree,
   pendiente de revisión final de rama y merge a `master`.
6. ✅ `apps/mobile` (Expo Router, loop principal de la app)
7. ⬜ Pendiente: CI básico (GitHub Actions) + `docs/architecture.md` y
   `docs/data-model.md`

Después de la Fase 5, lo único que falta del plan original es la Fase 7.
A partir de ahí, el trabajo pasa a ser mantenimiento/mejora continua sobre
lo ya construido (autenticación real, tests de `apps/api`, nuevas plantillas
de banco, etc.) — ya no fases numeradas con confirmación obligatoria entre
cada una, aunque sigo avisando qué falta decidir o qué asumí en cualquier
trabajo grande antes de darlo por cerrado.

## Flujo de trabajo para features/fases grandes

Para trabajo no trivial (una fase nueva, un cambio con varias piezas que
dependen entre sí):

- **Aislar en un git worktree** (`superpowers:using-git-worktrees` o
  `EnterWorktree`) para no pisar el checkout principal mientras se trabaja.
- **Implementar directamente**, sin despachar un subagente implementador +
  un subagente revisor por cada tarea individual del plan — eso quemó
  demasiados tokens en la Fase 5. Reservar subagentes solo para partes
  genuinamente complejas que valga la pena aislar de mi propio contexto
  (una investigación abierta, un bug profundo tipo el de Cloudflare Workers
  en la Fase 5).
- **Una sola revisión final** al terminar toda la fase (no una por tarea),
  antes de mergear a `master`.

Esto reemplaza el uso extensivo de `superpowers:subagent-driven-development`
(un implementador + un revisor por tarea) que se usó en la Fase 5 — quedó
documentado como referencia en
`.claude/worktrees/email-worker/.superpowers/sdd/2026-08-20-email-worker/progress.md`,
pero no es el patrón a repetir tal cual.

## Al terminar un pedazo de trabajo grande

Dime qué falta decidir o qué asumí, para que lo confirmes antes de seguir
con lo siguiente.
