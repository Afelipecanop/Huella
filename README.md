# Huella

**No dejes gasto sin huella.**

Huella es una app de código abierto para llevar el control de absolutamente
todos tus gastos. Su diferencial frente a otras apps de finanzas personales:

- **Captura automática por correo.** Reenvías tus correos bancarios a una
  dirección única (`usuarioX@huella.app`) y Huella los parsea automáticamente
  para crear tus transacciones — sin depender de leer notificaciones del
  sistema (imposible de forma confiable en iOS).
- **Efectivo como ciudadano de primera clase.** Registrar un gasto en
  efectivo es tan rápido como registrar uno con tarjeta: solo monto, fecha y
  cuenta son obligatorios. Categoría y comercio se completan después.

Si el parseo automático de un correo falla, el dato nunca se pierde: queda
como un evento de ingesta pendiente para categorizarlo a mano.

## Estado del proyecto

En desarrollo activo — Fase 1 (monorepo base).

## Arquitectura

- **App móvil**: React Native + Expo (TypeScript), Expo Router.
- **Backend**: Node.js + TypeScript + Fastify + Prisma + PostgreSQL.
- **Captura de correos**: Cloudflare Email Routing + Email Workers
  (TypeScript), usando `postal-mime` y plantillas de parseo por banco.
- **Tipos compartidos**: esquemas Zod usados por los tres proyectos.
- **Monorepo**: pnpm workspaces.

## Estructura

```
huella/
├── apps/
│   ├── mobile/         # Expo (RN)
│   ├── api/             # Fastify + Prisma
│   └── email-worker/    # Cloudflare Worker
├── packages/
│   ├── shared-types/     # esquemas Zod
│   └── bank-templates/   # reglas de parsing por banco
├── docs/
└── .github/workflows/
```

## Modelo de datos (núcleo)

- **Users** — id, email, name, default_currency
- **Accounts** — banco, efectivo o billetera; la cuenta "efectivo" es una
  fila más, sin caso especial
- **Categories** — con subcategorías vía autorreferencia
- **Transactions** — origen manual o por correo
- **IngestionEvents** — registro crudo de cada correo recibido, se cree o no
  la transacción
- **BankTemplates** — reglas de extracción por banco, pensadas para que la
  comunidad agregue bancos nuevos

## Desarrollo

Requiere [pnpm](https://pnpm.io/) (vía `corepack enable`) y Node.js 20+.

```bash
pnpm install
```

## Licencia

[MIT](./LICENSE)
