# Modelo de datos

Fuente de verdad: [`packages/db/prisma/schema.prisma`](../packages/db/prisma/schema.prisma). Este doc explica el porqué de las decisiones que no son obvias leyendo el schema solo.

Convención general: todo `id` es un `cuid(2)`; toda columna se mapea a `snake_case` en Postgres (`@map`) aunque el campo del modelo sea camelCase — así el contrato de la API (definido por los esquemas Zod de `@huella/shared-types`, en snake_case) queda lo más cerca posible del nombre real de columna.

## `User`

Campos: `id`, `email` (único), `passwordHash`, `name`, `defaultCurrency` (`Char(3)`, ISO 4217), `createdAt`, `updatedAt`.

`passwordHash` guarda un hash argon2id, nunca la contraseña en texto plano — se agregó junto con `RefreshToken` para reemplazar el placeholder de auth (`x-user-id`) por login real. Es una columna requerida sin default: no hubo que migrar usuarios existentes porque no había ninguno en producción al momento del cambio.

## `RefreshToken`

Campos: `id`, `userId`, `tokenHash` (único), `expiresAt`, `revokedAt` (nullable), `createdAt`.

- **`tokenHash`, no el token en crudo.** Se persiste `sha256(token)`; el valor real solo lo ve el cliente una vez, en la respuesta de `/auth/login|register|refresh`. Así una fuga de la base de datos no expone tokens usables.
- **`revokedAt` nullable en vez de borrar la fila.** Permite auditar/depurar sesiones sin perder el historial; un token "vivo" es `revokedAt IS NULL AND expiresAt > now()`, chequeado en `apps/api/src/routes/auth.ts`.
- **Sin `@@unique([userId])`.** Un usuario puede tener varios refresh tokens vigentes a la vez — realista para una app que se usa desde varios dispositivos. Cada `/auth/refresh` rota el token (revoca el presentado, emite uno nuevo), pero eso no afecta a los tokens de otras sesiones/dispositivos.
- `onDelete: Cascade` desde `User`: borrar un usuario limpia sus tokens.

## `Account`

Campos: `id`, `userId`, `name`, `type` (`bank | cash | wallet`), `currency`, `bankTemplateId` (nullable), `createdAt`, `updatedAt`.

La cuenta "efectivo" es una fila más de `Account` (`type: cash`), sin caso especial en el modelo — así el resto de la app (transacciones, filtros) no necesita ramificar lógica según el tipo de cuenta. `bankTemplateId` es opcional y nullable: vincula la cuenta a la plantilla que sabe extraer campos de los correos de ese banco, usado por `apps/email-worker` para resolver a qué cuenta pertenece una transacción parseada. `onDelete: SetNull` en la relación con `BankTemplate` — si se borra una plantilla, las cuentas que la usaban no se borran, solo pierden el vínculo.

## `Category`

Campos: `id`, `userId`, `parentId` (nullable, autorreferencia), `name`, `type` (`income | expense`), `createdAt`, `updatedAt`.

Subcategorías vía autorreferencia (`parent`/`subcategories`) en vez de una entidad separada — mantiene el modelo chico mientras la jerarquía se necesite a un solo nivel de profundidad real. `onDelete: SetNull` en `parent`: borrar una categoría padre no borra en cascada sus hijas, las deja sin padre.

## `Transaction`

Campos: `id`, `userId`, `accountId`, `categoryId` (nullable), `amount` (`Int`, unidad mínima de la moneda — centavos, nunca float), `currency`, `merchant` (nullable), `date`, `source` (`manual | email`), `status` (`pending | confirmed`), `createdAt`, `updatedAt`.

- **`amount` como `Int`, no `Decimal`/`Float`.** Evita errores de redondeo de punto flotante en dinero; el signo indica dirección (negativo = egreso, positivo = ingreso).
- **`source`/`status`.** Una transacción manual siempre nace `confirmed` (el usuario la cargó a propósito). Una transacción por correo puede nacer `pending` si el parseo extrajo los campos pero todavía no se confirmó — hoy `apps/email-worker` no expone ese flujo de confirmación manual, es terreno para una fase futura.
- `onDelete: Cascade` desde `Account` y `User`; `onDelete: SetNull` desde `Category` (borrar una categoría no borra las transacciones que la usaban).

## `IngestionEvent`

Campos: `id`, `userId`, `templateId` (nullable), `transactionId` (nullable, único), `rawContent` (`Text`), `parsedOk`, `createdAt` — **sin `updatedAt`**.

Registro crudo e inmutable de cada correo recibido, se haya podido parsear o no — por eso no tiene `updatedAt`, nunca se edita. Es el mecanismo de "el dato nunca se pierde": si el parseo automático falla (plantilla no matchea, regex no extrae un campo), igual queda esta fila (`parsedOk: false`, `transactionId: null`) para revisar a mano, en vez de descartar el correo silenciosamente. `transactionId` es único porque, cuando el parseo sí tiene éxito, cada evento de ingesta produce como mucho una transacción.

## `BankTemplate`

Campos: `id`, `bankName`, `country` (`Char(2)`, ISO 3166-1 alpha-2), `senderPattern` (único, regex contra el remitente del correo), `extractionRules` (`Json`), `createdAt`, `updatedAt`.

Recurso global, no scopeado por usuario — pensado para que la comunidad agregue bancos nuevos sin depender de que cada usuario cargue su propia plantilla. `extractionRules` queda como `Json` (no una tabla normalizada) porque su shape (ver `ExtractionRule` en `@huella/shared-types`) todavía es un borrador que se ajustó recién al construir el parser real de `apps/email-worker`; normalizarlo antes de tener un segundo banco real (hoy solo existe la plantilla de Bancolombia) hubiera sido diseñar sobre datos insuficientes.
