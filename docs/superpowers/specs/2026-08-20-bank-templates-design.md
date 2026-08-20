# Fase 4 — packages/bank-templates

## Contexto

`packages/bank-templates` está vacío (solo `.gitkeep`). El contrato de datos
ya existe en `@huella/shared-types` (`BankTemplate`, `ExtractionRule`) y
`apps/api` ya expone CRUD completo sobre `bank_templates` vía
`POST/GET/PATCH/DELETE /bank-templates`, respaldado por el modelo Prisma
`BankTemplate` (`bank_name`, `country`, `sender_pattern`,
`extraction_rules: Json`).

El propósito de esta fase es sentar el patrón real de parseo: una plantilla
de un banco concreto (Bancolombia) más un motor que aplique sus
`extraction_rules` contra el texto de un correo y produzca los campos de una
transacción. `apps/email-worker` (Fase 5) va a importar y usar este motor
tal cual, con cualquier plantilla que exista en la base de datos.

## Decisiones ya tomadas

- **Alcance del paquete**: datos (plantilla de Bancolombia) + motor de
  parseo genérico (`matchTemplate`, `extractFields`). No es solo un
  paquete de datos — sin el motor no queda validado el patrón.
- **El motor no decide signo (gasto/ingreso)**: `extractFields` devuelve el
  monto como magnitud sin signo (en centavos). Decidir si una transacción
  es débito o crédito depende de las palabras del correo ("Compra" vs
  "Abono"/"Consignación") y le corresponde a `apps/email-worker`, que va a
  tener el contexto completo de la notificación. Esta fase no construye esa
  heurística.
- **Test runner**: Vitest. Ni `apps/api` ni `packages/shared-types` tienen
  tests hoy; `jest-expo` (usado en `apps/mobile`) trae dependencias de
  React Native que no aplican acá. Vitest es liviano, ESM-nativo, y encaja
  para un paquete TypeScript/Node puro.
- **Fixture de correo**: un correo de notificación de "Compra" de
  Bancolombia fabricado (no real), basado en el formato público conocido de
  sus alertas transaccionales — remitente
  `alertasynotificaciones@bancolombia.com.co`, con datos de comercio/monto/
  fecha ficticios.
- **Seed**: `apps/api/prisma/seed.ts` importa el registro de plantillas
  desde `@huella/bank-templates` y hace upsert por `sender_pattern`
  (idempotente), conectado vía el campo `migrations.seed` de
  `prisma.config.ts` y un script `db:seed` en `apps/api/package.json`.

## Estructura del paquete

```
packages/bank-templates/
  package.json                      # @huella/bank-templates
  tsconfig.json
  vitest.config.ts
  src/
    templates/
      bancolombia.ts                # bancolombiaTemplate: CreateBankTemplate
      index.ts                      # templates: CreateBankTemplate[]
    engine/
      matchTemplate.ts
      extractFields.ts
      normalizeAmount.ts
      normalizeDate.ts
    fixtures/
      bancolombia-compra.ts         # correo de ejemplo (asunto, from, body)
    index.ts                        # exports públicos
    __tests__/
      bancolombia.test.ts           # valida el patrón end-to-end
      normalizeAmount.test.ts
```

## Motor de parseo

### `matchTemplate(sender: string, templates: BankTemplate[]): BankTemplate | undefined`

Recorre `templates` y devuelve la primera cuyo `sender_pattern` (regex)
matchea `sender`. `email-worker` la usa para decidir qué plantilla aplicar
a un correo entrante antes de llamar a `extractFields`.

### `extractFields(template: BankTemplate, rawContent: string): ExtractedFields | null`

```ts
type ExtractedFields = {
  amount: number;      // centavos, magnitud sin signo
  merchant?: string;
  date?: string;        // ISO 8601
  currency?: string;
};
```

Para cada `extraction_rule` de la plantilla, corre `new RegExp(rule.pattern)`
contra `rawContent` y toma `match[rule.group]`. Aplica coerción según
`field`:

- `amount` → `normalizeAmount(rawMatch)` (ver abajo). Si falla el match o el
  parseo, la extracción completa devuelve `null` — `amount` es obligatorio.
- `date` → `normalizeDate(rawMatch)` (ver abajo). Si falla el match o el
  parseo, la extracción completa devuelve `null` — `date` es obligatorio.
- `merchant`, `currency` → el string capturado, recortado (`trim()`). Si la
  regla no matchea, el campo queda `undefined` (no bloquean la extracción).

### `normalizeAmount(raw: string): number`

Convierte un string de monto en formato colombiano (`"$50.000,00"` o
`"50.000,00"`) a centavos como entero: quita el símbolo de moneda y
espacios, quita `.` (separador de miles), reemplaza `,` por `.` (decimal), y
convierte a centavos (`Math.round(valor * 100)`). Sin este paso, un
`parseFloat` ingenuo interpretaría `"50.000,00"` como `50` (corta en el
primer `.`) — un bug real que esta fase existe en parte para prevenir.

### `normalizeDate(raw: string): string`

Recibe fecha y hora capturadas juntas en un solo grupo, formato
`"dd/mm/yyyy a las HH:MM"` (el formato que usan las notificaciones de
Bancolombia). Las interpreta como hora de Colombia (`America/Bogota`,
offset fijo `UTC-05:00` todo el año — Colombia no tiene horario de verano,
así que un offset fijo es seguro y correcto siempre) y devuelve el ISO
8601 en UTC correspondiente. Ej.: `"20/08/2026 a las 14:32"` →
`"2026-08-20T19:32:00.000Z"`.

## Plantilla de Bancolombia

```ts
export const bancolombiaTemplate: CreateBankTemplate = {
  bank_name: "Bancolombia",
  country: "CO",
  sender_pattern: "^alertasynotificaciones@bancolombia\\.com\\.co$",
  extraction_rules: [
    { field: "amount", pattern: "por \\$([\\d.,]+)", group: 1 },
    { field: "merchant", pattern: "en (.+?) el", group: 1 },
    { field: "date", pattern: "el (\\d{2}/\\d{2}/\\d{4} a las \\d{2}:\\d{2})", group: 1 },
  ],
};
```

(Los patrones exactos se ajustan durante la implementación contra el
fixture real que se escriba — este bloque es ilustrativo del shape, no el
texto final.)

## Fixture de correo

Un correo de "Compra" ficticio con el formato público conocido de
Bancolombia:

```
From: alertasynotificaciones@bancolombia.com.co
Subject: Bancolombia le informa

Bancolombia le informa que ha realizado una Compra por $85.000,00 en
ALMACENES EXITO el 20/08/2026 a las 14:32 desde su producto *1234.
```

El test `bancolombia.test.ts` corre `matchTemplate` + `extractFields` contra
este fixture y verifica: `amount === 8500000` (centavos), `merchant ===
"ALMACENES EXITO"`, `date === "2026-08-20T19:32:00.000Z"` (14:32 hora
Colombia, `UTC-05:00`, convertido a UTC).

## Seed

`apps/api/prisma/seed.ts`:

```ts
import { PrismaClient } from "@prisma/client";
import { templates } from "@huella/bank-templates";

const prisma = new PrismaClient();

for (const template of templates) {
  await prisma.bankTemplate.upsert({
    where: { senderPattern: template.sender_pattern },
    update: { ...template },
    create: { ...template },
  });
}
```

Esto requiere agregar `@@unique` sobre `sender_pattern` en el modelo
`BankTemplate` de `schema.prisma` (hoy no tiene constraint de unicidad) —
una migración nueva, aditiva, sin romper nada existente.

`prisma.config.ts` gana:

```ts
migrations: {
  seed: "tsx prisma/seed.ts",
}
```

Y `apps/api/package.json` gana el script `"db:seed": "prisma db seed"`.

## No-goals de esta fase

- No se construye el handler de email real (`apps/email-worker` es Fase 5).
- No se decide la heurística de signo débito/crédito.
- No se agregan más bancos — Bancolombia es la única plantilla, a modo de
  validar el patrón antes de escalar.
- No se soporta parseo de correos HTML (selectores CSS) — el comentario en
  `shared-types/src/bank-template.ts` lo menciona como posibilidad futura,
  pero el shape actual de `extraction_rules` (regex contra texto plano) no
  lo contempla, y esta fase no cambia ese shape.
