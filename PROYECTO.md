# Zorzal Lirio OS — Descripcion completa del proyecto

> Documento descriptivo: que es el sistema, como esta construido, que reglas
> implementa y en que estado se encuentra. Para instalar, migrar y desplegar,
> ver [README.md](README.md).
>
> Version en `package.json`: **1.0.0** · Rama: `main` · Remoto:
> `github.com/MaycollJaramillo01/Zorzal-Lirio` · Ultimo commit: `cdcb1e8`
> "Resolviendo todas las auditorias de desarroll".

---

## 1. Que es

**Zorzal Lirio OS** es el sistema operativo interno de un taller de confeccion de
uniformes en Honduras. Controla el ciclo de vida completo de cada orden de
compra, desde que el cliente la entrega hasta que se cobra y se cierra.

No es un ERP ni un CRM: es una sola cosa bien hecha — **saber donde esta cada
pedido, quien lo tiene, hace cuanto y si se va a incumplir el plazo**.

Problemas concretos que resuelve:

| Problema operativo | Como lo resuelve el sistema |
| --- | --- |
| "¿En que va el pedido del Colegio Santa Marta?" | Tablero Kanban con 7 columnas, una por etapa |
| "¿Quien lo tiene ahora?" | Responsable obligatorio en cada etapa (salvo `CLOSED`) |
| "¿Desde cuando esta ahi?" | Historial inmutable con `entered_at` / `exited_at` / `elapsed_minutes` |
| "¿Vamos tarde?" | SLA por etapa con estados En tiempo / Proximo a vencer / Atrasado |
| "Nadie me aviso" | Cron diario que envia alertas por correo o al log, sin duplicar |
| "¿Quien movio esto?" | Bitacora de auditoria con actor, antes, despues e IP |
| "¿Cuanto tardamos realmente?" | Reportes de carga, tiempos por etapa, throughput y exportacion CSV |

**Idioma:** toda la interfaz, los mensajes de error y los correos estan en
espanol. El codigo y los comentarios tambien (sin tildes, convencion del repo).

**Zona horaria:** todo se **almacena en UTC** y se **muestra en
`America/Tegucigalpa`** (`APP_TIMEZONE`).

---

## 2. Stack tecnologico

| Capa | Tecnologia |
| --- | --- |
| Runtime | Node.js >= 22, ESM puro (`"type": "module"`) |
| Lenguaje | TypeScript 5.8, estricto, en backend, frontend y compartido |
| API | Express 5 |
| Base de datos | PostgreSQL en **Neon** via `@neondatabase/serverless` sobre WebSocket |
| ORM / migraciones | Drizzle ORM 0.44 + drizzle-kit 0.31 |
| Validacion | Zod 3 (misma definicion para API y formularios) |
| Auth | Sesiones opacas en base de datos + cookie `HttpOnly`; bcryptjs (12 rondas) |
| Frontend | React 19, Vite 6, React Router 7, TanStack Query 5, Tailwind 4 |
| Drag & drop | `@dnd-kit` (con alternativa por teclado) |
| Graficas | Recharts |
| Correo | Nodemailer (opcional; si esta apagado, las alertas van al log) |
| Logs | Pino + pino-http, con `/api/health` excluido del log automatico |
| Pruebas | Vitest (unit + api + client), Supertest, Testing Library, Playwright |
| Despliegue | Vercel (SPA estatica + una funcion serverless + cron) |

El driver **WebSocket** de Neon no es un detalle menor: habilita transacciones
interactivas reales, que son las que hacen atomica una transicion de etapa
(`server/db/client.ts:8-10`).

---

## 3. Arquitectura

### 3.1 Forma general

```
Navegador (SPA React)
      │  fetch con cookie de sesion
      ▼
/api/*  →  Express 5
      │
      ├─ middleware   auth · RBAC · rate limit · errores
      ├─ routes       declaracion de rutas y rol minimo
      ├─ controllers  parseo HTTP + respuesta uniforme
      ├─ services     reglas de negocio  ◄── shared/lib (SLA, transiciones, permisos)
      ├─ repositories SQL via Drizzle
      ▼
Neon PostgreSQL (12 tablas)
```

El mismo `createApp()` (`server/app.ts`) se usa en tres contextos:

1. `server/local.ts` — servidor local que ademas sirve los estaticos del SPA.
2. `api/index.ts` — funcion serverless de Vercel (292 bytes: solo exporta la app).
3. `tests/api/*` — Supertest monta la app en memoria.

No hay una segunda version del backend para produccion.

### 3.2 Estructura de carpetas

```
zorzal-lirio-os/
├── api/index.ts              Entry point serverless de Vercel
├── client/                   SPA React + Vite + Tailwind
│   └── src/
│       ├── components/       ui.tsx (base) + indicators.tsx (SLA, prioridad)
│       ├── features/kanban/  KanbanBoard, OrderCardItem, FiltersBar, TransitionModal
│       ├── features/orders/  OrderFormModal
│       ├── layouts/          AppLayout (sidebar, header, breadcrumbs)
│       ├── lib/              api.ts (fetch tipado), format.ts
│       ├── pages/            Login, Dashboard, Orders, OrderDetail, Team, Sla, Reports, Profile, NotFound
│       ├── routes/           guards.tsx (ProtectedRoute, ManagerRoute)
│       └── services/         queries.ts (todos los hooks de TanStack Query)
├── server/
│   ├── app.ts                Construccion de Express
│   ├── local.ts              Servidor local (API + estaticos)
│   ├── config/               env.ts (Zod sobre process.env), logger.ts (Pino)
│   ├── controllers/          auth, order, report, stage, system, user
│   ├── db/                   client.ts, schema.ts, seed.ts, migrations/
│   ├── middleware/           auth.ts, rateLimit.ts, errorHandler.ts
│   ├── repositories/         10 modulos, uno por agregado
│   ├── routes/index.ts       Mapa completo de la API
│   ├── services/             11 modulos de reglas de negocio
│   ├── types/                auth.ts, express.d.ts (augmentacion de Request)
│   └── utils/                appError, apiResponse, csv, tokens, validate
├── shared/                   Compartido entre backend y frontend
│   ├── constants/            enums.ts, stages.ts, errors.ts
│   ├── lib/                  sla.ts, transitions.ts, permissions.ts, datetime.ts
│   ├── schemas/              Zod: auth, orders, users, stages, reports, common
│   └── types/index.ts        DTOs de la API
├── scripts/check-sla.ts      Revision manual de SLA (mismo servicio que el cron)
├── tests/                    unit · api · client · e2e
├── drizzle.config.ts · vercel.json · vitest.config.ts · playwright.config.ts
└── README.md · PROYECTO.md
```

### 3.3 Principio rector: una sola fuente de verdad

El proyecto insiste en que ninguna regla exista dos veces:

| Regla | Unica implementacion | Quien la consume |
| --- | --- | --- |
| Formula de SLA | `shared/lib/sla.ts` → `computeSla()` | `SlaService` (backend, autoridad) y el frontend solo para vistas provisionales |
| Reglas de movimiento por rol | `shared/lib/transitions.ts` → `evaluateTransition()` | Backend autoriza, frontend habilita/deshabilita controles |
| Capacidades por rol | `shared/lib/permissions.ts` → `capabilitiesFor()` | Guards de ruta y menus del frontend, RBAC del backend |
| Revision de SLA completa | `server/services/slaCheckService.ts` → `runSlaCheck()` | `GET /api/cron/sla` y `npm run check:sla` |
| Validacion de entrada | `shared/schemas/*` (Zod) | Endpoints del backend y formularios de React Hook Form |
| Carga de ordenes activas + SLA | `orderService.loadActiveOrderCards()` | Dashboard, reportes y equipo |

---

## 4. Modelo de datos (12 tablas)

Migracion inicial: `server/db/migrations/0000_init.sql`. Esquema Drizzle:
`server/db/schema.ts`.

| Tabla | Rol | Detalles clave |
| --- | --- | --- |
| `users` | Personas del sistema | `role` (OWNER/ADMIN/PLANT), `is_active`, `must_change_password`, `is_primary_owner` |
| `stages` | Las 7 etapas | `code`, `position` (unicos), `sla_minutes`, `warning_before_minutes`, `is_sla_enabled` |
| `user_stage_focus` | Etapas de enfoque de cada usuario | PK compuesta; define que ve un usuario PLANT |
| `orders` | La orden de produccion | `order_code` unico, `version` (concurrencia optimista), `is_archived`, `closed_at` |
| `order_stage_history` | Historial inmutable por tramo | **Indice unico parcial**: un solo tramo abierto por orden (`exited_at is null`) |
| `order_notes` | Notas de la orden | Se ocultan (`is_hidden`), nunca se borran |
| `alerts` | Alertas de SLA emitidas | `dedupe_key` unica; `status` PENDING/SENT/FAILED; `attempt_count` |
| `sessions` | Sesiones activas | Solo el **hash** del token; `expires_at`, IP y user agent |
| `audit_logs` | Bitacora | `action`, `before_data`, `after_data`, `metadata` (JSONB), IP |
| `system_settings` | Configuracion general | `key` / `value` JSONB |
| `order_sequences` | Consecutivo anual | Genera `ZL-2026-0001` de forma transaccional |
| `cron_locks` | Lock del cron | `expires_at`, `locked_by`, `last_summary` |

Dos garantias del esquema merecen destacarse:

1. **Un unico tramo abierto por orden.** El indice parcial
   `order_stage_history_open_unique` hace imposible, a nivel de base de datos,
   que una orden este simultaneamente en dos etapas.
2. **El consecutivo es transaccional.** `order_sequences` evita que dos
   creaciones concurrentes generen el mismo `ZL-AAAA-NNNN` (hay una prueba de
   integracion especifica para eso).

---

## 5. Dominio y reglas de negocio

### 5.1 Las 7 etapas

Definidas en `shared/constants/stages.ts`; el seed las crea y despues el SLA se
administra desde la interfaz.

| # | Codigo | Nombre visible | SLA inicial | Advertencia previa |
| ---: | --- | --- | ---: | ---: |
| 1 | `ORDER_RECEIVED` | Orden recibida | 1 dia | **medio dia** |
| 2 | `FABRIC_PURCHASE` | Compra de tela | 5 dias | 1 dia |
| 3 | `WORKSHOP` | En taller | 10 dias | 1 dia |
| 4 | `EMBROIDERY` | Bordado | 5 dias | 1 dia |
| 5 | `SHIPPING` | Envio | 2 dias | 1 dia |
| 6 | `COLLECTION` | Cobro | 7 dias | 1 dia |
| 7 | `CLOSED` | Cerrado | sin SLA | — |

> La advertencia de la etapa 1 es de **medio dia**, no de un dia: con un aviso
> igual al SLA la etapa nacia siempre en "Proximo a vencer" y el estado "En
> tiempo" era inalcanzable (`shared/constants/stages.ts:34-36`). El README
> todavia dice "1 dia antes" en esa fila.

### 5.2 Formula de SLA

`shared/lib/sla.ts`:

```
sla_due_at  = stage_entered_at + sla_minutes
warning_at  = sla_due_at - warning_before_minutes

NORMAL  : now <  warning_at
WARNING : warning_at <= now <= sla_due_at
OVERDUE : now >  sla_due_at
NO_SLA  : la etapa no tiene SLA activo (o sla_minutes <= 0)
```

Devuelve ademas `minutesInStage`, `minutesRemaining` (negativo si vencio) y
`minutesOverdue`. Se usa **tiempo calendario**: esta version no excluye fines de
semana ni feriados.

Detalle operativo importante: el SLA de la primera etapa corre desde la **fecha
de recepcion de la orden de compra**, no desde el momento en que se captura
(`orderService.ts:167-169`). Una OC registrada con tres dias de retraso aparece
vencida de inmediato, que es justo lo que el negocio quiere ver.

### 5.3 La transicion de etapa

Es la operacion critica del sistema (`orderService.transitionOrder`). Arrastrar
una tarjeta **no toca la base de datos**: abre un modal de confirmacion con
pedido, etapa anterior, etapa nueva, responsable actual, selector de nuevo
responsable y nota opcional. Solo al confirmar se ejecuta, dentro de una unica
transaccion:

1. Verifica la `version` de la orden — si otro usuario la movio, responde **409**.
2. Cierra el tramo abierto del historial y calcula `elapsed_minutes`.
3. Abre el tramo nuevo con su responsable y `entered_at`.
4. Actualiza etapa, responsable, `closed_at` y `version` de la orden.
5. Registra el movimiento en `audit_logs` con antes, despues, tipo de movimiento,
   razon, nota y minutos transcurridos.

Si algo falla, la transaccion se revierte completa y la tarjeta vuelve a su
columna original.

Validaciones previas: la etapa destino existe, el movimiento esta permitido para
el rol, hay razon cuando se exige, hay responsable cuando la etapa no es
`CLOSED`, y el responsable elegido existe y esta activo.

### 5.4 Reglas de movimiento por rol

`shared/lib/transitions.ts` clasifica cada movimiento como `SAME`, `FORWARD`,
`SKIP` o `BACKWARD`:

| Movimiento | OWNER | ADMIN | PLANT |
| --- | :-: | :-: | :-: |
| Avanzar a la etapa siguiente (`FORWARD`) | si | si | si |
| Saltar etapas (`SKIP`) | si, con razon | si, con razon | **no** |
| Regresar (`BACKWARD`) | si, con razon | si, con razon | **no** |
| Misma etapa (`SAME`) | no | no | no |

### 5.5 Permisos generales

`shared/lib/permissions.ts` — OWNER y ADMIN son "gestores"; PLANT es operativo.

| Capacidad | OWNER / ADMIN | PLANT |
| --- | :-: | :-: |
| Ver todas las ordenes | si | solo las suyas y las de sus etapas de enfoque |
| Crear / editar / archivar ordenes | si | no |
| Reasignar responsable | si | no |
| Administrar usuarios y SLA | si | no |
| Ver reportes y auditoria | si | resumen propio unicamente |
| Ocultar notas | si | no |

Regla adicional: **el dueno principal** (primer OWNER creado por el seed,
`is_primary_owner`) no puede ser degradado, desactivado ni renombrado por nadie
mas que el mismo; y un ADMIN no puede modificar a un OWNER.

Visibilidad para PLANT (`orderService.canSeeOrder`): ve una orden si es su
responsable **o** si la etapa actual esta entre sus etapas de enfoque.

### 5.6 Nada se borra

- Ordenes: archivado logico (`is_archived`), con restauracion.
- Usuarios: desactivacion (`is_active = false`), que ademas revoca sus sesiones.
- Notas: ocultamiento (`is_hidden`) con autor y fecha del ocultamiento.
- Historial: nunca se sobreescribe; cada movimiento agrega un tramo nuevo.

---

## 6. SLA, alertas y cron

### 6.1 El ciclo de revision

`server/services/slaCheckService.ts` → `runSlaCheck({ trigger })`:

1. Toma un lock con TTL de 5 minutos en `cron_locks`. Si ya hay una revision en
   curso, devuelve `skipped: true` sin error.
2. Carga solo las ordenes **activas** (ni cerradas ni archivadas).
3. Aplica `SlaService.computeForRow` y se queda con las que estan en `WARNING` u
   `OVERDUE`.
4. Construye los planes de alerta y los despacha.
5. Reintenta las alertas fallidas que aun tienen intentos disponibles (max 3).
6. Libera el lock **siempre**, incluso ante error (`finally`).

Un mismo resumen (`SlaCheckSummary`) sale tanto por HTTP como por consola.

### 6.2 Destinatarios y deduplicacion

Destinatarios de cada alerta: **el responsable actual + todos los OWNER y ADMIN
activos**, sin repetir (`mergeRecipients`). Los gestores se consultan una sola
vez por corrida, no una vez por orden atrasada.

La deduplicacion es estructural: `dedupe_key = order_id + stage_history_id +
alert_type + recipient_user_id` con indice unico. Consecuencias:

- El cron puede correr N veces al dia sin enviar nada repetido.
- Si la orden pasa a una **etapa nueva**, cambia `stage_history_id` y por lo
  tanto vuelve a alertar. Esto tambien esta cubierto por pruebas.

### 6.3 Canal

- `EMAIL_ENABLED=true` + SMTP configurado → correo con Nodemailer, canal `EMAIL`.
- Apagado (por defecto) → log estructurado de Pino, canal `CONSOLE`, visible en
  los logs de Vercel. No se pierde nada: la alerta igual queda en la tabla.

### 6.4 Disparadores

| Disparador | Como |
| --- | --- |
| Automatico | Cron de Vercel, `0 14 * * *` UTC = **8:00 a. m. de Tegucigalpa** |
| Manual (HTTP) | `GET /api/cron/sla` con `Authorization: Bearer ${CRON_SECRET}` (401 sin el) |
| Manual (CLI) | `npm run check:sla`, imprime resumen y devuelve exit code |

---

## 7. API REST

Prefijo `/api`. Respuesta siempre con la misma envoltura:

```json
{ "success": true,  "data": { }, "error": null }
{ "success": false, "data": null, "error": { "code": "ORDER_VERSION_CONFLICT", "message": "..." } }
```

Los codigos de error viven en `shared/constants/errors.ts` y los construye
`server/utils/appError.ts` (`httpErrors.versionConflict()`, `.reasonRequired()`,
`.assigneeRequired()`, `.orderArchived()`, `.invalidTransition()`, etc.).

| Metodo | Ruta | Rol minimo |
| --- | --- | --- |
| GET | `/api/health` | publico |
| GET | `/api/cron/sla` | `Bearer CRON_SECRET` |
| POST | `/api/auth/login` | publico (rate limit estricto) |
| POST | `/api/auth/logout` | publico |
| GET | `/api/auth/me` | autenticado |
| POST | `/api/auth/change-password` | autenticado |
| GET | `/api/users` | autenticado (PLANT recibe listado reducido) |
| POST · GET·id · PATCH·id | `/api/users` | OWNER / ADMIN |
| POST | `/api/users/:id/reset-password` · `/activate` · `/deactivate` | OWNER / ADMIN |
| PUT | `/api/users/:id/stage-focus` | OWNER / ADMIN |
| GET | `/api/stages` | autenticado |
| PATCH | `/api/stages/:id/sla` | OWNER / ADMIN |
| GET | `/api/orders` | autenticado (PLANT filtrado) |
| POST | `/api/orders` | OWNER / ADMIN |
| GET | `/api/orders/:id` | autenticado (PLANT solo las suyas) |
| PATCH | `/api/orders/:id` | OWNER / ADMIN |
| POST | `/api/orders/:id/transition` | autenticado |
| POST | `/api/orders/:id/reassign` · `/archive` · `/restore` | OWNER / ADMIN |
| GET · POST | `/api/orders/:id/notes` | autenticado |
| POST | `/api/orders/:orderId/notes/:noteId/hide` | OWNER / ADMIN |
| GET | `/api/orders/:id/history` | autenticado |
| GET | `/api/orders/:id/audit` | OWNER / ADMIN |
| GET | `/api/reports/summary` | autenticado (PLANT ve solo lo suyo) |
| GET | `/api/reports/workload` · `/overdue` · `/stage-times` · `/throughput` · `/export` | OWNER / ADMIN |

Orden de los middlewares en `server/routes/index.ts`, que no es casual:

1. `/health` y `/cron/sla` quedan **antes** de la autenticacion (el cron usa su
   propio secreto).
2. `attachAuth` lee la cookie y adjunta el usuario si es valida.
3. Las rutas de sesion y cambio de contrasena se registran **antes** de
   `requirePasswordUpToDate`, para que un usuario obligado a cambiar su clave
   pueda hacerlo.
4. El resto de la API exige sesion y contrasena al dia.

---

## 8. Frontend

SPA en React 19 con React Router 7. `client/src/App.tsx` define el arbol:

| Ruta | Pagina | Acceso |
| --- | --- | --- |
| `/login` | `LoginPage` | publica |
| `/dashboard` | `DashboardPage` — KPIs, distribucion por etapa, carga, top atrasadas, actividad reciente | autenticado |
| `/orders` | `OrdersPage` — tablero Kanban + filtros | autenticado |
| `/orders/:orderId` | `OrderDetailPage` — datos, historial, notas, auditoria | autenticado |
| `/team` | `TeamPage` — usuarios, roles, etapas de enfoque, activacion | OWNER / ADMIN |
| `/sla` | `SlaPage` — configuracion de tiempos por etapa (en dias) | OWNER / ADMIN |
| `/reports` | `ReportsPage` — carga, atrasadas, tiempos, throughput, CSV | OWNER / ADMIN |
| `/profile` | `ProfilePage` — cambio de contrasena | autenticado |

Puntos de diseno:

- **Datos:** un solo modulo de hooks (`services/queries.ts`) con `queryKeys`
  centralizadas; `staleTime` 15 s, sin refetch al enfocar la ventana.
- **Kanban:** `@dnd-kit` para arrastrar, y cada tarjeta incluye un boton
  **Mover** que abre el mismo modal — el drag and drop nunca es el unico camino.
- **Filtros persistidos en la URL:** `/orders?assignee=me&sla=OVERDUE&priority=URGENT`
  se puede compartir y recargar.
- **Accesibilidad:** el estado de SLA se comunica con texto ademas de color
  (`describeSla()` → "Atrasado por 3 d 4 h"), con pruebas que lo verifican.
- **Fechas:** el frontend nunca formatea a mano; usa `shared/lib/datetime.ts`,
  que ancla las fechas de calendario al mediodia UTC para que Tegucigalpa (UTC-6) no
  muestre el dia anterior.
- **Guards:** `ProtectedRoute` y `ManagerRoute` en `routes/guards.tsx`; ocultar
  un enlace nunca sustituye la autorizacion del servidor.

---

## 9. Seguridad

| Area | Implementacion |
| --- | --- |
| Contrasenas | bcryptjs, 12 rondas (8 en test). Nunca en texto plano |
| Login | Comparacion contra un hash falso cuando el correo no existe, para no filtrar por tiempo que cuentas existen |
| Sesiones | Token opaco en cookie `zl_session` `HttpOnly` + `SameSite=Lax` + `Secure` en produccion; en base de datos **solo el hash**; TTL 7 dias |
| Revocacion | Todas las sesiones del usuario se borran al cambiar o restablecer la contrasena y al desactivarlo |
| Rate limit | Estricto en `/api/auth/login`, general para el resto de `/api` |
| Cabeceras | Helmet con CSP explicita (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`) |
| CORS | Restringido a `APP_URL` + los origenes de Vite en desarrollo, con credenciales |
| Cuerpos | JSON limitado a 256 kB, urlencoded a 64 kB |
| Validacion | Zod en cada endpoint; consultas parametrizadas via Drizzle |
| RBAC | Verificado en el servidor en cada ruta (`requireManager`) y ademas dentro de los servicios |
| Concurrencia | `version` en `orders`; conflicto → 409 y la interfaz recarga en lugar de sobreescribir |
| CSV | Neutraliza prefijos de inyeccion de formulas (`=`, `+`, `-`, `@`) — con prueba dedicada |
| Logs | Pino estructurado, sin stack traces en produccion |
| Arranque | En produccion la app **no levanta** si falta `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET` o `APP_URL`, e imprime exactamente cual |

---

## 10. Configuracion

`server/config/env.ts` valida `process.env` con Zod y falla temprano.

| Variable | Obligatoria | Nota |
| --- | --- | --- |
| `NODE_ENV` | no | `development` \| `test` \| `production` |
| `PORT` | no | 3000 |
| `DATABASE_URL` | **si en prod** | Cadena **pooled** de Neon (con `-pooler`) |
| `DATABASE_URL_UNPOOLED` | recomendada | Cadena directa, la usa drizzle-kit |
| `APP_URL` | **si en prod** | CORS y enlaces de las alertas |
| `APP_TIMEZONE` | no | `America/Tegucigalpa` |
| `SESSION_SECRET` | **si en prod** | minimo 32 caracteres |
| `CRON_SECRET` | **si en prod** | minimo 16 caracteres |
| `SMTP_*` | no | Solo si `EMAIL_ENABLED=true` (entonces `SMTP_HOST` pasa a ser obligatorio) |
| `EMAIL_ENABLED` | no | `false` por defecto: alertas al log |
| `SEED_DEFAULT_USERS` | no | `true` por defecto |
| `LOG_LEVEL` | no | `info` |

En desarrollo hay secretos por defecto explicitamente marcados como no aptos para
produccion.

### Usuarios iniciales (seed)

| Rol | Correo | Contrasena | Enfoque |
| --- | --- | --- | --- |
| OWNER | `owner@zorzallirio.local` | `owner123` | todas (dueno principal) |
| ADMIN | `admin@zorzallirio.local` | `admin123` | todas |
| PLANT | `compras@zorzallirio.local` | `planta123` | Compra de tela |
| PLANT | `taller@zorzallirio.local` | `planta123` | En taller, Bordado |
| PLANT | `envio@zorzallirio.local` | `planta123` | Envio, Cobro |

El seed es **idempotente**: crea etapas, usuarios, enfoques y configuracion
general sin borrar ni sobreescribir nada existente (en particular, respeta el SLA
que se haya ajustado desde la interfaz). En produccion las cuentas nacen con
`must_change_password = true` y no crea ordenes de demostracion; en desarrollo
crea 6 ordenes de ejemplo con clientes nicaraguenses.

---

## 11. Pruebas

`vitest.config.ts` define dos proyectos, con `fileParallelism: false` porque las
pruebas de integracion comparten una sola base Neon (en paralelo se pisan el
consecutivo de ordenes y las alertas del cron).

| Suite | Que cubre | Requiere base de datos |
| --- | --- | --- |
| `tests/unit` | Formula SLA (bordes exactos de `warning_at` y `due_at`), reglas de transicion por rol, esquemas Zod, deduplicacion de alertas, contenido de alertas, escapado e inyeccion en CSV, fechas de calendario en zona horaria, rangos de reportes por dia completo | no |
| `tests/client` | `KanbanBoard`, `FiltersBar`, `TransitionModal`, `SlaBadge`, `PriorityBadge` — incluye modo solo lectura y la alternativa al arrastre | no |
| `tests/api` | Supertest sobre la app real: login, credenciales invalidas, usuario desactivado, RBAC, creacion con codigo consecutivo, concurrencia, razon obligatoria, 409 por version, cierre sin responsable, archivado logico, cron autorizado y deduplicacion | **si** (`DATABASE_URL`); se omiten solas si falta |
| `tests/e2e` | Playwright: flujo de administrador, flujo de planta (incluye que planta no vea administracion ni pueda saltar etapas), flujo de SLA, y ausencia de scroll horizontal | si, migrada y sembrada |

`tests/unit/regressions.test.ts` es notable: cada caso corresponde a un bug real
ya corregido (dia anterior por zona horaria, rangos de reporte que perdian media
jornada, inyeccion de formulas en CSV, duplicacion de gestores en alertas).

---

## 12. Comandos

```bash
npm run dev            # API con recarga (tsx watch) + Vite en :5173
npm run build          # tsc -> dist/  +  vite build -> client/dist/
npm run start          # servidor unico en :3000 (API + estaticos)
npm run lint           # eslint, --max-warnings=0
npm run typecheck      # tsc --noEmit para servidor y cliente
npm test               # vitest run (unit + client + api)
npm run test:e2e       # playwright
npm run db:generate    # SQL desde el esquema Drizzle (sin conexion)
npm run db:migrate     # aplicar migraciones a Neon
npm run db:seed        # seed idempotente
npm run db:studio      # Drizzle Studio
npm run check:sla      # revision manual de SLA
```

---

## 13. Despliegue

Vercel, configurado por `vercel.json`:

- **Build:** `npm run build:client` → `client/dist` como salida estatica.
- **Funcion:** `api/index.ts`, `maxDuration` 60 s.
- **Rewrites:** todo `/api/*` a la funcion; el resto al `index.html` del SPA.
- **Cron:** `/api/cron/sla` diario a las `0 14 * * *` UTC.

Las migraciones y el seed **no** corren en el despliegue: se ejecutan desde la
maquina del desarrollador apuntando a la base de produccion. Verificacion post
deploy: `/api/health` (devuelve `status`, `database`, `timestamp`), login, y una
llamada manual al cron con el `CRON_SECRET`.

---

## 14. Estado actual y observaciones

**Estado:** completo y desplegable. Cuatro commits en `main`, alineado con
`origin/main`. El ultimo, `cdcb1e8` ("Resolviendo todas las auditorias de
desarroll"), cerro la ronda de auditorias; los dos anteriores fueron el rediseno
visual y del login.

Puntos abiertos, menores:

1. **`scripts/tmp-users.ts` sin versionar.** Script temporal que borra usuarios
   de prueba (`desactivado-*@zorzallirio.local`, `intruso-*@zorzallirio.local`)
   dejados por las pruebas de integracion. Es el unico archivo en estado
   `untracked`. Conviene borrarlo o convertirlo en una limpieza formal de la
   suite de pruebas.
2. **README desactualizado en una fila.** La tabla de etapas del README dice
   "1 dia antes" para la advertencia de `ORDER_RECEIVED`; el codigo usa medio
   dia, y con razon (ver 5.1).
3. **SLA en tiempo calendario.** No excluye fines de semana ni feriados. Es una
   decision consciente de esta version, no un olvido; si el negocio lo pide, el
   cambio se hace en un solo lugar (`shared/lib/sla.ts`).
4. **`.env` presente en el arbol de trabajo** con credenciales reales de Neon.
   Esta cubierto por `.gitignore`, pero conviene no perderlo de vista al copiar
   o comprimir la carpeta.
