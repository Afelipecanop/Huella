# Fase 5 — apps/email-worker

## Contexto

`apps/email-worker` está vacío (solo `.gitkeep`). El motor de parseo ya
existe y está validado (`@huella/bank-templates`, Fase 4): `matchTemplate`
identifica la plantilla por remitente, `extractFields` extrae monto/fecha/
comercio/moneda de texto plano. El propósito de esta fase es construir el
Cloudflare Email Worker que recibe los correos reenviados por el usuario a
`<user_id>@ingest.huella.app`, aplica ese motor, y persiste el resultado —
siempre, sea o no exitoso el parseo.

Dos piezas del repo ya insinuaban el diseño antes de esta fase:

- El README (`Novedades recientes`, Fase 5) describe: identificar al
  usuario por el destinatario, parsear MIME con `postal-mime`, usar
  `@huella/bank-templates`, y escribir directo a Postgres vía Prisma +
  Cloudflare Hyperdrive — **sin pasar por `apps/api`**.
- El comentario en `apps/api/src/routes/ingestion-events.ts` decía que la
  creación de `IngestionEvent` se resolvería "vía el webhook del
  email-worker" — lo cual contradice lo anterior. Esta fase resuelve la
  contradicción a favor de la escritura directa (ver Decisiones) y corrige
  ese comentario.

## Decisiones ya tomadas

- **Escritura directa a Postgres, no webhook.** El worker usa su propio
  Prisma Client (vía Cloudflare Hyperdrive) y escribe `IngestionEvent`/
  `Transaction` directo. Se evita un salto de red extra por correo
  procesado; a cambio, la lógica de negocio (decidir si se crea la
  transacción) vive en el worker, no en `apps/api`. El comentario
  desactualizado en `ingestion-events.ts` se corrige como parte de esta
  fase.
- **`packages/db` — Prisma como paquete compartido.** `schema.prisma` se
  muda de `apps/api/prisma/` a `packages/db/prisma/`, junto con las
  migraciones existentes y `seed.ts`. `packages/db` exporta el
  `PrismaClient` generado y sus tipos. Tanto `apps/api` como
  `apps/email-worker` dependen de `@huella/db` (`workspace:*`). Es la
  única fuente de verdad del schema — necesaria porque a partir de esta
  fase hay dos consumidores del mismo modelo de datos, y duplicar
  `schema.prisma` arriesga que se desincronicen silenciosamente.
  `apps/api` pierde su carpeta `prisma/` y sus scripts `prisma:*`; esos
  scripts se mueven a `packages/db/package.json`.
- **`Account.bank_template_id` (nuevo campo, opcional).** FK nullable a
  `BankTemplate` (`onDelete: SetNull`). Resuelve a qué cuenta pertenece una
  transacción parseada: `remitente → BankTemplate (matchTemplate) → Account
  del mismo user_id con ese bank_template_id`. Migración aditiva sobre
  `packages/db/prisma/schema.prisma`. `createAccountSchema`/
  `updateAccountSchema` en `@huella/shared-types` ganan
  `bank_template_id: idSchema.nullable().optional()`.
- **Transacciones parseadas nacen `pending`, nunca `confirmed`.** Un error
  de regex no debe colarse directo a las cuentas del usuario sin revisión;
  el usuario las confirma en la app, igual que puede pasar con una entrada
  manual.
- **`parsed_ok` es verdadero solo si se creó la `Transaction`.** Si el
  remitente no matchea ningún template, si `extractFields` devuelve `null`,
  o si no hay exactamente una `Account` vinculada al template — el correo
  se persiste igual como `IngestionEvent`, pero con `parsed_ok: false` y
  `transaction_id: null`. El dato nunca se pierde: queda para revisión
  manual. `template_id` se guarda siempre que un template matcheó el
  remitente, incluso si el resto de la extracción falló después.
- **Cuenta ambigua se trata como fallo, no como elección arbitraria.** Si
  hay más de una `Account` del usuario con el mismo `bank_template_id`, el
  worker no adivina cuál — cae al mismo camino que "sin cuenta vinculada"
  (`parsed_ok: false`). Es un caso raro; resolverlo bien requeriría UI que
  no existe todavía.
- **Moneda: fallback a la cuenta.** `extractFields` puede no capturar
  `currency` (varias plantillas no la necesitan si el banco solo opera en
  una moneda). La `Transaction` usa `extracted.currency ?? account.currency`.
- **Alcance: código + tests locales, no despliegue.** No se compra dominio
  ni se configura Cloudflare Email Routing en producción en esta fase —
  igual que bank-templates y mobile no se desplegaron en las suyas. Eso es
  Fase 7 (infraestructura).
- **Recipiente inválido o usuario inexistente: se descarta sin persistir
  nada.** No hay `user_id` a quien asociar un `IngestionEvent` si el
  destinatario no es un `cuid` de un usuario real — a diferencia de los
  demás casos de fallo, aquí no hay dónde guardar el registro.

## Estructura del monorepo (cambios)

```
packages/
  db/                              # NUEVO — antes vivía en apps/api/prisma
    package.json                   # @huella/db
    prisma.config.ts               # movido desde apps/api/
    prisma/
      schema.prisma                # + Account.bank_template_id
      seed.ts                      # movido, sin cambios de lógica
      migrations/
        20260820054533_init/
        20260820170623_add_bank_template_sender_unique/
        <nueva>_add_account_bank_template_id/   # NUEVA
    src/
      index.ts                     # export { PrismaClient } from "@prisma/client" (re-export)

apps/
  api/
    prisma/                        # ELIMINADO (movido a packages/db)
    package.json                   # pierde deps prisma directas, gana @huella/db
    src/plugins/prisma.ts          # import { PrismaClient } from "@huella/db"
    src/routes/ingestion-events.ts # comentario corregido

  email-worker/
    package.json                   # @huella/email-worker
    wrangler.jsonc                 # config de Cloudflare Worker (dev-only bindings)
    tsconfig.json
    vitest.config.ts
    src/
      index.ts                     # export default { email: async (message, env, ctx) => ... }
      resolveUser.ts               # destinatario -> user_id, valida cuid + existencia
      parseEmail.ts                # postal-mime -> { from, text }
      processEmail.ts              # orquesta match/extract/resolveAccount/persist
      persist.ts                   # las 3 rutas de escritura (éxito, fallos, descarte)
    __tests__/
      processEmail.test.ts         # casos: feliz, sin template, extracción fallida,
                                    # sin cuenta, cuenta ambigua, destinatario inválido
      fixtures/
        bancolombia-compra.eml.ts  # MIME crudo (reusa el fixture de bank-templates
                                    # como cuerpo, envuelto en headers MIME reales)
```

## Flujo (`processEmail`)

```
email() handler (Cloudflare Email Routing)
  │
  ├─ resolveUser(message.to) ──► user_id inválido o no existe
  │                                   └─► descartar (no persiste nada)
  │
  ├─ parseEmail(message.raw) [postal-mime] ──► { from, text }
  │
  ├─ matchTemplate(from, templates)
  │     │
  │     ├─ sin match ──► IngestionEvent{ parsed_ok:false, template_id:null,
  │     │                                transaction_id:null }
  │     │
  │     └─ match ──► extractFields(template, text)
  │           │
  │           ├─ null ──► IngestionEvent{ parsed_ok:false, template_id,
  │           │                           transaction_id:null }
  │           │
  │           └─ ExtractedFields ──► buscar Account(user_id, bank_template_id)
  │                 │
  │                 ├─ 0 o >1 cuentas ──► IngestionEvent{ parsed_ok:false,
  │                 │                                     template_id,
  │                 │                                     transaction_id:null }
  │                 │
  │                 └─ 1 cuenta ──► crear Transaction{
  │                                     source: "email", status: "pending",
  │                                     amount, date, merchant,
  │                                     currency: extracted.currency ?? account.currency,
  │                                     accountId, categoryId: null,
  │                                   }
  │                                 ──► IngestionEvent{ parsed_ok:true,
  │                                     template_id, transaction_id }
```

Cada rama que persiste un `IngestionEvent` incluye siempre `raw_content`.
Se guarda el texto plano extraído del correo (el mismo `text` que consume
`extractFields`), no el MIME crudo — más útil para revisión manual en la
app, y evita persistir attachments/headers irrelevantes.

## `resolveUser`

```ts
function resolveUser(to: string): string | null
```

Extrae la parte local de `to` (antes de `@ingest.huella.app`), valida que
tenga forma de `cuid` (mismo formato que `idSchema` en `@huella/shared-types`),
y confirma que exista un `User` con ese `id`. Devuelve el `user_id` o
`null`. La verificación de existencia toca la base de datos — es la única
consulta antes de decidir si vale la pena seguir procesando el correo.

## `parseEmail`

Usa `postal-mime` para parsear `message.raw` (el `ReadableStream` que da
Cloudflare Email Routing). Devuelve `{ from: string; text: string }`.
`text` prioriza el cuerpo `text/plain` del correo; si viene vacío, usa el
`text/html` despojado de tags como fallback simple (no hay parseo de
selectores CSS — mismo no-goal que Fase 4). Si no hay texto en ningún
formato, `text` es `""` y el flujo sigue normalmente (`extractFields`
devolverá `null` sobre contenido vacío, cayendo en la rama de fallo ya
definida).

## Prisma en el Worker

Cloudflare Workers no corren Node.js completo por defecto. Se habilita
`compatibility_flags: ["nodejs_compat"]` en `wrangler.jsonc`, y el
`schema.prisma` de `packages/db` gana:

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["driverAdapters"]
}
```

El worker instancia el cliente con el adaptador `@prisma/adapter-pg` sobre
la connection string que expone el binding de Hyperdrive
(`env.HYPERDRIVE.connectionString`), en vez del `new PrismaClient()` simple
que usa `apps/api`. `apps/api` no usa `driverAdapters` — sigue con su
`DATABASE_URL` normal vía el `datasource db` de siempre; el preview feature
es aditivo y no le cambia el comportamiento.

## Testing

`vitest` + `@cloudflare/vitest-pool-workers` (Miniflare) para invocar
`email()` con MIME crudo de fixtures, contra el Postgres de
`docker-compose.yml` (mismo patrón de base "real" en tests que ya usa
`bank-templates`, extendido a integración). Casos cubiertos:

1. Feliz: template matchea, campos se extraen, hay una cuenta vinculada →
   se crea `Transaction` + `IngestionEvent{parsed_ok:true}`.
2. Sin template: remitente no matchea ningún `sender_pattern`.
3. Extracción fallida: template matchea pero `extractFields` devuelve
   `null` (p. ej. correo sin monto reconocible).
4. Sin cuenta vinculada: extracción exitosa, pero el usuario no tiene
   ninguna `Account` con ese `bank_template_id`.
5. Cuenta ambigua: el usuario tiene dos `Account` con el mismo
   `bank_template_id`.
6. Destinatario inválido: `to` no es un `cuid` válido, o no corresponde a
   ningún `User` — no se persiste nada.

## No-goals de esta fase

- No se despliega el worker ni se configura el dominio/DNS real de
  Cloudflare Email Routing — Fase 7.
- No se agregan más bancos ni se ajustan las `extraction_rules` de
  Bancolombia — eso es contenido de `bank-templates`, no de esta fase.
- No se construye UI para que el usuario vincule `Account.bank_template_id`
  — por ahora se asume que se setea directo (seed/API existente de
  `PATCH /accounts/:id`, que ya acepta cualquier campo de
  `updateAccountSchema`). Una pantalla dedicada en `apps/mobile` queda
  para una fase futura si se decide necesaria.
- No se resuelve la heurística de débito/crédito (signo del monto) más
  allá de lo que ya decidió Fase 4: `extractFields` no la aplica, y esta
  fase tampoco — todo lo que llega vía `bank-templates` hoy son compras
  (gasto), consistente con la única plantilla que existe.
