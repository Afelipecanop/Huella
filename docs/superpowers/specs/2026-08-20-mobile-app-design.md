# Fase 6 — Pantallas móviles (loop principal)

## Contexto

`apps/mobile` está vacío. El backend (Fastify + Prisma, `apps/api`) ya expone
CRUD completo para las 6 entidades núcleo, con auth placeholder vía header
`x-user-id`. Esta fase construye la primera versión de la app Expo: el loop
principal de "no dejes gasto sin huella" — ver transacciones y registrar un
gasto en efectivo de forma instantánea.

## Decisiones ya tomadas

- **Identidad del usuario en mobile**: sin login todavía. Un `DEV_USER_ID`
  fijo en config local, coherente con que el backend tampoco tiene JWT.
  Se reemplaza cuando exista auth real.
- **Alcance de pantallas**: loop principal únicamente — lista de
  transacciones (home), entrada manual de efectivo, detalle/edición de una
  transacción. Cuentas y categorías se siembran a mano en la DB por ahora;
  no tienen pantallas de gestión propias en esta fase.
- **Arquitectura elegida** (de 3 opciones evaluadas): NativeWind (Tailwind
  para RN) + TanStack Query + Expo Router. Se descartó StyleSheet nativo
  puro (más repetitivo, más fácil de desviar del sistema de diseño) y una
  librería de componentes completa tipo Tamagui/RN Paper (look genérico,
  dependencia pesada para 3 pantallas).

## Identidad visual

Investigada con la skill `ui-ux-pro-max` (`--design-system`, `--domain color`,
`--domain style`, `--domain typography`).

- **Estilo**: Flat Design Mobile (Touch-First) — sin sombras/elevación,
  jerarquía por color y espaciado, touch targets ≥48px, baja complejidad,
  10/10 en compatibilidad RN/Expo.
- **Tipografía**: Lexend (títulos) + Source Sans 3 (cuerpo) — par "Corporate
  Trust", optimizada para legibilidad y accesibilidad.
- **Montos**: cifras tabulares/monoespaciadas para que la lista no "salte"
  al cambiar de dígitos. Egresos (monto negativo) en rojo, ingresos
  (positivo) en verde.
- **Modo claro y oscuro** (ambos desde el arranque, sin toggle manual —
  siguen `useColorScheme()` del sistema; NativeWind aplica el modo vía
  variantes `dark:`):

  | Token | Claro | Oscuro |
  |---|---|---|
  | background | `#F8FAFC` | `#0F172A` |
  | surface/card | `#FFFFFF` | `#1E293B` |
  | foreground | `#0F172A` | `#F8FAFC` |
  | muted foreground | `#64748B` | `#94A3B8` |
  | border | `#E1F2ED` | `rgba(255,255,255,0.08)` |
  | primary | `#059669` | `#10B981` |
  | destructive | `#DC2626` | `#F87171` |

  Los tonos oscuros son variantes más claras/desaturadas del color base, no
  una inversión directa — mantiene ≥4.5:1 de contraste en ambos modos.

## Estructura del proyecto

```
apps/mobile/
├── app/                        # Expo Router
│   ├── _layout.tsx              # Stack raíz, fuentes, QueryClientProvider
│   ├── index.tsx                 # Home: lista de transacciones
│   ├── entry.tsx                  # Modal: entrada manual instantánea
│   └── transaction/[id].tsx        # Detalle / edición
├── src/
│   ├── api/                       # client.ts + accounts.ts + transactions.ts + categories.ts
│   ├── hooks/                     # useTransactions, useAccounts, useCategories, useCreateTransaction...
│   ├── components/                # Money, TransactionRow, EmptyState...
│   ├── theme/                     # colors.ts (light/dark), typography.ts, spacing.ts
│   └── config.ts                  # DEV_USER_ID, API_BASE_URL
├── __tests__/ (o *.test.ts(x) colocados junto a cada módulo)
├── app.json / app.config.ts
├── package.json
└── tsconfig.json
```

## Flujo de datos

TanStack Query sobre un `client.ts` que agrega `x-user-id: DEV_USER_ID` a
cada request y usa directo los tipos de `@huella/shared-types` para
inputs/outputs — mismo contrato que ya valida la API (`createManualTransactionSchema`,
`transactionSchema`, etc.). Las mutaciones invalidan `['transactions']` (y
`['accounts']` cuando aplique) para que la lista se refresque sola.

## Pantallas

1. **Home** (`app/index.tsx`) — `FlatList` de transacciones (más reciente
   primero), fila con monto/comercio/fecha/cuenta, pull-to-refresh, estado
   vacío con guía, botón flotante (+) que abre el modal de entrada.
2. **Entrada manual** (`app/entry.tsx`, modal) — monto (teclado numérico
   grande), fecha (default ahora), selector de cuenta (auto-seleccionada si
   hay una sola). Sin comercio/categoría acá — se completan después en el
   detalle, tal como pide el producto. Botón Guardar con estado de carga;
   cierra el modal al éxito.
3. **Detalle/edición** (`app/transaction/[id].tsx`) — todos los campos
   editables incluyendo categoría (picker desde `useCategories`), y
   Eliminar con confirmación en un modal propio (nunca `Alert.alert`
   bloqueante).

## Errores y estados de carga

- Skeletons en la carga inicial de listas.
- Spinner + disabled en botones durante mutaciones.
- Banner inline (no alerts nativos) para errores de red.
- Estado vacío con botón de reintento si falla el `GET` inicial.
- Errores 400 de validación del backend (`{ error, issues }`) mapeados a
  los campos correspondientes del formulario.

## Testing

- Stack: `jest-expo` (preset oficial de Expo) + `@testing-library/react-native`.
- Alcance de esta fase:
  - Unitarios: `src/theme` (tokens exportados correctamente por modo),
    `src/api/client.ts` (normalización de errores 4xx/5xx), hooks de
    `src/hooks` con `fetch` mockeado (sin pegarle a la API real).
  - Componentes: `TransactionRow` (signo/color del monto según positivo o
    negativo), `EmptyState`, validación del formulario de entrada manual
    (botón Guardar deshabilitado sin `account_id`/`amount`/`date`).
- Fuera de alcance: Detox/E2E — infraestructura más pesada, se evalúa
  cuando haya más pantallas.
- Script `pnpm test` en `apps/mobile/package.json`.

## Fuera de alcance (explícito)

- Login/auth real.
- Pantallas de gestión de Accounts/Categories.
- Revisión de `IngestionEvent`s pendientes (depende de `apps/email-worker`,
  fase futura).
- Toggle manual de tema (solo sigue el sistema).
- Tests E2E.
