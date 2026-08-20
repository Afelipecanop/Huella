<div align="center">

# 👣 Huella

**No dejes gasto sin huella.**

App de código abierto para control de gastos, con captura automática por correo y entrada manual de efectivo como funcionalidad de primera clase

[![TypeScript](https://img.shields.io/badge/TypeScript-Monorepo-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![pnpm](https://img.shields.io/badge/pnpm-workspaces-F69220?logo=pnpm&logoColor=white)](https://pnpm.io/)
[![Fastify](https://img.shields.io/badge/Fastify-API-000000?logo=fastify&logoColor=white)](https://fastify.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Database-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Expo](https://img.shields.io/badge/Expo-App%20móvil-000020?logo=expo&logoColor=white)](https://expo.dev/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Email%20Workers-F38020?logo=cloudflare&logoColor=white)](https://developers.cloudflare.com/email-routing/email-workers/)
[![License](https://img.shields.io/badge/license-MIT-brightgreen)](./LICENSE)
[![Status](https://img.shields.io/badge/status-en%20desarrollo%20activo-orange)](#-estado-actual)

</div>

---

## 📌 Tabla de contenidos

- [Sobre el proyecto](#-sobre-el-proyecto)
- [Estado actual](#-estado-actual)
- [Arquitectura](#-arquitectura)
- [Características](#-características)
- [Novedades recientes](#-novedades-recientes)
- [Modelo de datos (núcleo)](#-modelo-de-datos-núcleo)
- [Stack técnico](#-stack-técnico)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Instalación rápida](#-instalación-rápida)
- [Cómo correr los tests](#-cómo-correr-los-tests)
- [Variables de entorno](#-variables-de-entorno)
- [Despliegue](#-despliegue)
- [Próximos pasos](#-próximos-pasos)

---

##  Sobre el proyecto

Huella es una app para llevar el control de absolutamente todos tus gastos. Su diferencial frente a otras apps de finanzas personales:

- **Captura automática por correo.** Reenvías tus correos bancarios a una dirección única (`<tu-id>@ingest.huella.app`) y Huella los parsea automáticamente para crear tus transacciones — sin depender de leer notificaciones del sistema (imposible de forma confiable en iOS).
- **Efectivo como ciudadano de primera clase.** Registrar un gasto en efectivo es tan rápido como registrar uno con tarjeta: solo monto, fecha y cuenta son obligatorios. Categoría y comercio se completan después.

Si el parseo automático de un correo falla, el dato nunca se pierde: queda como un evento de ingesta pendiente para revisarlo a mano.

##  Estado actual

**En desarrollo activo, sin desplegar todavía.** El proyecto avanza fase por fase; esto es lo que hay hoy:

| Módulo | Estado |
|---|---|
| Monorepo base (pnpm workspaces) | ✅ Listo |
| Tipos compartidos (`@huella/shared-types`) | ✅ Listo — esquemas Zod de las 6 entidades núcleo |
| API (`apps/api` — Fastify + Prisma + PostgreSQL) | ✅ Listo — CRUD de cuentas, categorías, transacciones y plantillas de banco |
| App móvil (`apps/mobile` — Expo + Expo Router) | ✅ Listo — loop principal: lista, entrada manual, detalle/edición |
| Motor de parseo de bancos (`@huella/bank-templates`) | ✅ Listo — plantilla de Bancolombia validada de punta a punta |
| Captura automática por correo (`apps/email-worker`) | 🚧 En diseño |
| Autenticación real (JWT/sesiones) | ⏳ Pendiente — hoy usa un placeholder (`x-user-id`) |
| CI + documentación de arquitectura | ⏳ Pendiente |
| Tests automatizados en `apps/api` | ⏳ Pendiente — hoy solo `apps/mobile` y `packages/bank-templates` tienen suite |

## 🏗️ Arquitectura

```mermaid
flowchart LR
    subgraph Cliente["📱 Cliente"]
        MOBILE["App móvil\nExpo + Expo Router\n(TypeScript)"]
    end

    subgraph Servidor["⚙️ Backend — apps/api (Fastify)"]
        API["API REST"]
        AUTH["Auth · placeholder x-user-id"]
        CRUD["Accounts · Categories ·\nTransactions · BankTemplates"]
    end

    subgraph Ingesta["📧 Captura por correo — apps/email-worker"]
        CFER["Cloudflare\nEmail Routing"]
        WORKER["Email Worker\nMIME parsing (postal-mime)"]
    end

    DB[(" PostgreSQL")]
    BT["📦 @huella/bank-templates\nmatchTemplate · extractFields"]
    ST["📦 @huella/shared-types\nesquemas Zod"]

    MOBILE -->|"HTTPS / JSON\nx-user-id"| API
    API --> AUTH & CRUD
    CRUD --> DB

    CFER -->|email trigger| WORKER
    WORKER -->|usa| BT
    WORKER -->|"Prisma + Hyperdrive\n(conexión directa)"| DB

    API -.-> ST
    MOBILE -.-> ST
    WORKER -.-> ST
```

`apps/email-worker` no pasa por la API: escribe directo a la misma base de PostgreSQL vía Prisma + Cloudflare Hyperdrive, para evitar un salto de red extra en el camino de ingesta.

##  Características

<table>
<tr>
<td valign="top" width="50%">

### App móvil

- Lista de transacciones con estado vacío, pull-to-refresh y skeleton de carga
- Entrada manual de efectivo/gasto instantánea — solo monto, fecha y cuenta obligatorios
- Detalle y edición de una transacción (comercio, categoría), con confirmación de borrado
- Modo claro/oscuro automático, sigue el sistema
- Cliente tipado del API, reutilizando `@huella/shared-types`

</td>
<td valign="top" width="50%">

### Backend y datos

- API REST con Fastify + Prisma sobre PostgreSQL
- CRUD de cuentas, categorías, transacciones y plantillas de banco
- Registro inmutable de eventos de ingesta (correo crudo, se cree o no la transacción)
- Validación de payloads con Zod, compartida entre móvil, API y (próximamente) el worker
- `docker-compose.yml` para levantar Postgres en desarrollo local

</td>
</tr>
</table>

##  Novedades recientes

> El proyecto se construye fase por fase; esta sección resume qué se hizo en cada una, en orden.

- **Fase 1-3 — Base del monorepo, tipos y API.** pnpm workspaces, `@huella/shared-types` (esquemas Zod de Users, Accounts, Categories, Transactions, IngestionEvents y BankTemplates), y `apps/api` con Fastify + Prisma: rutas CRUD completas, auth placeholder vía header `x-user-id`, `docker-compose.yml` para Postgres local.
- **Fase 6 — App móvil.** `apps/mobile` con Expo Router: Home (lista + pull-to-refresh + skeleton), entrada manual de efectivo, detalle/edición con borrado confirmado por modal (no `Alert` nativo), NativeWind con modo claro/oscuro automático. Se detectó y corrigió una serie de tests con timeout flakeado por contención de CPU en corridas en frío (no un bug de la app) subiendo el timeout global de Jest.
- **Fase 4 — Motor de parseo de bancos.** `packages/bank-templates`: `matchTemplate`/`extractFields` (motor genérico basado en regex), la plantilla de Bancolombia y un fixture de correo realista que valida el patrón de punta a punta. Una revisión final encontró y corrigió un bug real: el regex de comercio no estaba anclado y capturaba texto incorrecto en frases realistas tipo "Compra en línea por $X en TIENDA el...".
- **Fase 5 — Captura por correo (en diseño).** `apps/email-worker`: Cloudflare Email Worker que identifica al usuario por el destinatario del correo (`<user_id>@ingest.huella.app`), parsea el MIME con `postal-mime`, usa `@huella/bank-templates` para extraer los campos, y escribe directo a Postgres vía Prisma + Cloudflare Hyperdrive (no a través de la API). Para resolver a qué cuenta pertenece cada transacción parseada, `Account` va a sumar un campo `bank_template_id` opcional.

## 🗃️ Modelo de datos (núcleo)

- **Users** — id, email, name, default_currency
- **Accounts** — banco, efectivo o billetera; la cuenta "efectivo" es una fila más, sin caso especial
- **Categories** — con subcategorías vía autorreferencia
- **Transactions** — origen manual o por correo, estado pendiente o confirmado
- **IngestionEvents** — registro crudo e inmutable de cada correo recibido, se cree o no la transacción
- **BankTemplates** — reglas de extracción por banco, pensadas para que la comunidad agregue bancos nuevos

## 🧰 Stack técnico

| Categoría | Tecnología |
|---|---|
| **Lenguaje** | TypeScript |
| **Monorepo** | pnpm workspaces |
| **App móvil** | Expo + Expo Router, NativeWind (Tailwind para RN), TanStack Query |
| **Backend** | Fastify + Prisma |
| **Base de datos** | PostgreSQL |
| **Captura de correos** | Cloudflare Email Routing + Email Workers, `postal-mime`, Cloudflare Hyperdrive |
| **Validación compartida** | Zod (`@huella/shared-types`) |
| **Testing** | Jest + Testing Library (`apps/mobile`), Vitest (`packages/bank-templates`) |
| **Infraestructura local** | Docker Compose (PostgreSQL) |

## 📁 Estructura del proyecto

```
huella/
├── apps/
│   ├── mobile/           # Expo + Expo Router (TypeScript)
│   ├── api/               # Fastify + Prisma
│   └── email-worker/       # Cloudflare Email Worker
├── packages/
│   ├── shared-types/       # esquemas Zod, usados por los tres apps
│   └── bank-templates/      # motor de parseo + plantillas por banco
├── docs/                    # specs y planes de cada fase
└── .github/workflows/       # CI (pendiente)
```

##  Instalación rápida

```bash
# 1. Habilitar pnpm
corepack enable

# 2. Instalar dependencias del monorepo
pnpm install

# 3. Levantar Postgres local
pnpm db:up

# 4. Configurar variables de entorno de apps/api
cp apps/api/.env.example apps/api/.env

# 5. Aplicar migraciones
pnpm --filter @huella/api exec prisma migrate dev

# 6. (Opcional) sembrar plantillas de banco
pnpm --filter @huella/api run db:seed

# 7. Levantar la API
pnpm --filter @huella/api dev

# 8. Configurar y levantar la app móvil
cp apps/mobile/.env.example apps/mobile/.env
pnpm --filter @huella/mobile start
```

## 🧪 Cómo correr los tests

```bash
# App móvil (Jest + Testing Library)
pnpm --filter @huella/mobile test

# Motor de parseo de bancos (Vitest)
pnpm --filter @huella/bank-templates test

# Typecheck de cualquier paquete/app
pnpm --filter <paquete> run typecheck
```

`apps/api` todavía no tiene suite de tests automatizados — es una brecha conocida, pendiente para una fase futura.

## 🔐 Variables de entorno

| Variable | Dónde | Propósito |
|---|---|---|
| `DATABASE_URL` | `apps/api/.env` | Cadena de conexión a PostgreSQL |
| `PORT` | `apps/api/.env` | Puerto de la API (default `3000`) |
| `EXPO_PUBLIC_API_URL` | `apps/mobile/.env` | URL base de la API que consume la app móvil |
| `EXPO_PUBLIC_DEV_USER_ID` | `apps/mobile/.env` | ID de usuario de desarrollo (reemplaza al placeholder de auth) |

> No se incluyen credenciales ni secretos en este repositorio.

##  Despliegue

Todavía no desplegado — desarrollo 100% local. La infraestructura pensada para producción (Cloudflare Pages/Workers para el worker de correo, un host para la API, Postgres gestionado) se define en la Fase 7 (CI + documentación de arquitectura).

##  Próximos pasos

- Terminar el diseño e implementación de `apps/email-worker` (Fase 5)
- CI básico con GitHub Actions + `docs/architecture.md` y `docs/data-model.md` (Fase 7)
- Autenticación real (reemplazar el placeholder `x-user-id`)
- Suite de tests para `apps/api`

---

<div align="center">

Proyecto de código abierto en desarrollo activo. Contribuciones y nuevas plantillas de banco son bienvenidas.

</div>
