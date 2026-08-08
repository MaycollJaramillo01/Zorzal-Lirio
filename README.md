# Zorzal Lirio OS

Sistema operativo interno para controlar de principio a fin la produccion de uniformes de
**Zorzal Lirio**: tablero Kanban con responsables por etapa, historial completo e inmutable,
tiempos SLA, alertas automaticas y reportes operativos.

Toda la interfaz esta en espanol. Las fechas se **almacenan en UTC** y se **muestran en
`America/Tegucigalpa`**.

---

## Tabla de contenido

1. [Que resuelve](#que-resuelve)
2. [Arquitectura](#arquitectura)
3. [Requisitos](#requisitos)
4. [Instalacion](#instalacion)
5. [Configuracion de Neon](#configuracion-de-neon)
6. [Variables de entorno](#variables-de-entorno)
7. [Migraciones](#migraciones)
8. [Seed](#seed)
9. [Inicio local](#inicio-local)
10. [Usuarios iniciales](#usuarios-iniciales)
11. [Flujo de produccion y reglas](#flujo-de-produccion-y-reglas)
12. [SLA y alertas](#sla-y-alertas)
13. [Ejecucion manual de SLA](#ejecucion-manual-de-sla)
14. [Pruebas](#pruebas)
15. [Build](#build)
16. [Deploy en Vercel](#deploy-en-vercel)
17. [Configuracion del cron](#configuracion-del-cron)
18. [Configuracion SMTP](#configuracion-smtp)
19. [API REST](#api-rest)
20. [Consideraciones de seguridad](#consideraciones-de-seguridad)
21. [Solucion de errores comunes](#solucion-de-errores-comunes)

---

## Que resuelve

- Registrar cuando se recibe cada orden de compra.
- Saber en que etapa esta cada pedido y quien es el responsable actual.
- Medir cuanto tiempo permanece un pedido en cada etapa.
- Avisar antes de incumplir el tiempo permitido y detectar pedidos atrasados.
- Consultar el historial completo y la auditoria de cada pedido.
- Analizar carga de trabajo por persona y tiempos promedio por etapa.
- Obtener reportes operativos y exportarlos a CSV.

---

## Arquitectura

```text
zorzal-lirio-os/
├── api/
│   └── index.ts                  # Funcion serverless de Vercel (exporta la app Express)
├── client/                       # SPA React + Vite + Tailwind
│   ├── index.html
│   ├── vite.config.ts
│   └── src/
│       ├── components/           # UI base e indicadores (SLA, prioridad, avatar)
│       ├── features/kanban/      # Tablero, filtros, modal de transicion
│       ├── features/orders/      # Formularios de orden
│       ├── layouts/              # Sidebar, header, breadcrumbs
│       ├── lib/                  # Cliente HTTP y formateo de fechas
│       ├── pages/                # Login, Dashboard, Ordenes, Equipo, SLA, Reportes, Perfil
│       ├── routes/               # Guards de sesion y de rol
│       └── services/queries.ts   # Hooks de TanStack Query
├── server/
│   ├── app.ts                    # Construccion de la app Express
│   ├── local.ts                  # Servidor local (API + estaticos del SPA)
│   ├── config/                   # Validacion de entorno y logger Pino
│   ├── controllers/              # Capa HTTP (parseo y respuesta)
│   ├── db/                       # Cliente Neon, esquema Drizzle, migraciones, seed
│   ├── middleware/               # Auth, RBAC, rate limit, manejo de errores
│   ├── repositories/             # Acceso a datos (SQL via Drizzle)
│   ├── routes/                   # Definicion de rutas de /api
│   ├── services/                 # Reglas de negocio (ordenes, SLA, alertas, reportes)
│   ├── types/                    # Tipos de sesion y augmentacion de Express
│   └── utils/                    # Errores, respuestas, CSV, tokens, validacion
├── shared/                       # Codigo compartido por backend y frontend
│   ├── constants/                # Etapas, roles, prioridades, codigos de error
│   ├── lib/                      # Formula SLA, reglas de transicion, permisos, fechas
│   ├── schemas/                  # Esquemas Zod (validan API y formularios)
│   └── types/                    # DTOs de la API
├── scripts/check-sla.ts          # Revision manual de SLA
├── tests/
│   ├── unit/                     # Reglas de dominio (sin base de datos)
│   ├── api/                      # Integracion con Supertest (requiere Neon)
│   ├── client/                   # React Testing Library
│   └── e2e/                      # Playwright
├── drizzle.config.ts
├── vercel.json
└── .env.example
```

Separacion de responsabilidades:

| Capa | Ubicacion |
| --- | --- |
| Presentacion | `client/src` |
| API HTTP | `server/routes`, `server/controllers` |
| Reglas de negocio | `server/services`, `shared/lib` |
| Acceso a datos | `server/repositories`, `server/db` |
| Validaciones | `shared/schemas`, `server/utils/validate.ts` |
| Autenticacion y RBAC | `server/services/authService.ts`, `server/middleware/auth.ts` |
| Alertas | `server/services/alertService.ts`, `server/services/slaCheckService.ts` |
| Reportes | `server/services/reportService.ts`, `server/repositories/reportRepository.ts` |

**Una sola formula de SLA.** Vive en `shared/lib/sla.ts` y el backend la expone a traves de
`SlaService` (`server/services/slaService.ts`). El frontend usa la misma funcion solo para
vistas provisionales: los valores que manda la API mandan.

**Una sola implementacion de la revision de SLA.** `SlaCheckService`
(`server/services/slaCheckService.ts`) la consumen tanto `GET /api/cron/sla` como
`npm run check:sla`.

---

## Requisitos

- **Node.js 22** o superior (`node -v`).
- **npm 10** o superior.
- Una base de datos **PostgreSQL en Neon** (plan gratuito suficiente).
- Cuenta de **Vercel** y repositorio en **GitHub** para el despliegue.

---

## Instalacion

```bash
git clone <url-de-tu-repositorio> zorzal-lirio-os
```

```bash
cd zorzal-lirio-os && npm install
```

```bash
cp .env.example .env
```

En Windows PowerShell:

```bash
Copy-Item .env.example .env
```

---

## Configuracion de Neon

1. Entra a <https://console.neon.tech> y crea un proyecto (por ejemplo `zorzal-lirio`).
2. Abre **Connection Details** y copia las dos cadenas de conexion:
   - La cadena **Pooled connection** (contiene `-pooler` en el host) va en `DATABASE_URL`.
   - La cadena **Direct connection** (sin `-pooler`) va en `DATABASE_URL_UNPOOLED`.
3. Verifica que ambas terminen en `?sslmode=require`.

Ejemplo de `.env`:

```env
DATABASE_URL=postgresql://usuario:clave@ep-xxxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://usuario:clave@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

La aplicacion usa `@neondatabase/serverless` sobre WebSocket, lo que habilita **transacciones
interactivas reales** (necesarias para las transiciones de etapa).

---

## Variables de entorno

| Variable | Obligatoria | Descripcion |
| --- | --- | --- |
| `NODE_ENV` | no | `development`, `test` o `production`. |
| `PORT` | no | Puerto local. Por defecto `3000`. |
| `DATABASE_URL` | **si en produccion** | Cadena pooled de Neon, usada por la aplicacion. |
| `DATABASE_URL_UNPOOLED` | recomendada | Cadena directa, usada por `drizzle-kit`. |
| `APP_URL` | **si en produccion** | URL publica. Se usa en CORS y en los enlaces de las alertas. |
| `APP_TIMEZONE` | no | Zona de presentacion. Por defecto `America/Tegucigalpa`. |
| `SESSION_SECRET` | **si en produccion** | Minimo 32 caracteres. Firma el hash de los tokens de sesion. |
| `CRON_SECRET` | **si en produccion** | Minimo 16 caracteres. Protege `GET /api/cron/sla`. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | no | Configuracion SMTP. |
| `EMAIL_ENABLED` | no | `true` envia correos; `false` escribe las alertas en el log. |
| `SEED_DEFAULT_USERS` | no | `true` crea los cinco usuarios iniciales en el seed. |
| `LOG_LEVEL` | no | Nivel de Pino (`info` por defecto). |

Genera los secretos con:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

En produccion, si falta `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET` o `APP_URL`, la
aplicacion **no arranca** e imprime exactamente cual falta.

---

## Migraciones

Generar SQL a partir del esquema Drizzle (no necesita conexion):

```bash
npm run db:generate
```

Aplicar las migraciones a Neon:

```bash
npm run db:migrate
```

Inspeccionar los datos con Drizzle Studio:

```bash
npm run db:studio
```

La migracion inicial crea 12 tablas, los indices de rendimiento y el **indice unico parcial**
que garantiza un unico tramo de historial abierto por orden.

---

## Seed

```bash
npm run db:seed
```

El seed es **idempotente**: se puede ejecutar cuantas veces sea necesario.

- Crea las siete etapas con su configuracion de SLA inicial.
- Crea los cinco usuarios iniciales con la contrasena hasheada (solo si no existen).
- Asigna las etapas de enfoque.
- Crea las configuraciones generales del sistema.
- **Nunca borra informacion existente** ni sobreescribe el SLA que hayas ajustado.
- En desarrollo crea 6 ordenes de demostracion; con `NODE_ENV=production` no crea ninguna.

---

## Inicio local

Modo desarrollo (API con recarga + Vite en `http://localhost:5173`):

```bash
npm run dev
```

Modo produccion local (un solo servidor en `http://localhost:3000`):

```bash
npm run build && npm run start
```

Verificacion rapida:

```bash
curl http://localhost:3000/api/health
```

Respuesta esperada:

```json
{ "status": "ok", "database": "connected", "timestamp": "2026-08-06T20:00:00.000Z" }
```

---

## Usuarios iniciales

| Rol | Nombre | Correo | Contrasena | Enfoque |
| --- | --- | --- | --- | --- |
| OWNER | Dueno Zorzal Lirio | `owner@zorzallirio.local` | `owner123` | Todas |
| ADMIN | Administrador | `admin@zorzallirio.local` | `admin123` | Todas |
| PLANT | Responsable de compras | `compras@zorzallirio.local` | `planta123` | Compra de tela |
| PLANT | Responsable de taller | `taller@zorzallirio.local` | `planta123` | En taller y Bordado |
| PLANT | Responsable de envios | `envio@zorzallirio.local` | `planta123` | Envio y Cobro |

En **produccion** estas cuentas nacen con `must_change_password = true`: el usuario solo puede
entrar a `/profile` hasta cambiar su contrasena. En desarrollo el valor es `false`.

Los talleres externos se registran como usuarios `PLANT` desde la seccion **Equipo**
(por ejemplo `Taller Confecciones Lopez`, enfoque `En taller`).

---

## Flujo de produccion y reglas

| Posicion | Codigo | Nombre visible | SLA inicial | Advertencia |
| ---: | --- | --- | ---: | ---: |
| 1 | `ORDER_RECEIVED` | Orden recibida | 1 dia | 1 dia antes |
| 2 | `FABRIC_PURCHASE` | Compra de tela | 5 dias | 1 dia antes |
| 3 | `WORKSHOP` | En taller | 10 dias | 1 dia antes |
| 4 | `EMBROIDERY` | Bordado | 5 dias | 1 dia antes |
| 5 | `SHIPPING` | Envio | 2 dias | 1 dia antes |
| 6 | `COLLECTION` | Cobro | 7 dias | 1 dia antes |
| 7 | `CLOSED` | Cerrado | Sin SLA | No aplica |

Al arrastrar una tarjeta la base de datos **no se toca**: se abre un modal de confirmacion que
muestra pedido, etapa anterior, etapa nueva, responsable actual, selector de nuevo responsable y
nota opcional. Solo al confirmar se ejecuta una transaccion que:

1. Verifica la version de la orden (concurrencia optimista).
2. Cierra el tramo anterior del historial y calcula `elapsed_minutes`.
3. Crea el tramo nuevo con su responsable.
4. Actualiza etapa, responsable y `version` de la orden.
5. Registra el movimiento en auditoria.

Si algo falla, la transaccion se revierte y la tarjeta vuelve a su columna original.

**Permisos de movimiento**

| Accion | OWNER | ADMIN | PLANT |
| --- | :-: | :-: | :-: |
| Avanzar a la etapa siguiente | si | si | si |
| Saltar etapas | si (con razon) | si (con razon) | no |
| Regresar a una etapa anterior | si (con razon) | si (con razon) | no |
| Reasignar responsable | si | si | no |
| Crear / editar / archivar ordenes | si | si | no |
| Administrar usuarios y SLA | si | si | no |
| Ver reportes y auditoria | si | si | no |

Toda etapa exige responsable **salvo `CLOSED`**. Las ordenes nunca se eliminan: se archivan
logicamente (`is_archived`).

El drag and drop tiene alternativa por teclado: cada tarjeta incluye el boton **Mover**, que abre
el mismo modal.

---

## SLA y alertas

Formula (una sola implementacion, en `shared/lib/sla.ts`):

```text
sla_due_at = stage_entered_at + sla_minutes
warning_at = sla_due_at - warning_before_minutes

NORMAL  : now <  warning_at
WARNING : now >= warning_at  y  now <= sla_due_at
OVERDUE : now >  sla_due_at
NO_SLA  : la etapa no tiene SLA activo
```

Se usa tiempo calendario: en esta version no se excluyen fines de semana.

El SLA de la primera etapa corre desde la **fecha de recepcion de la orden de compra**, no desde
el momento en que se captura. Asi una OC registrada con retraso aparece vencida de inmediato.

**Alertas.** Cuando una orden entra en `WARNING` u `OVERDUE` se notifica al responsable actual y
a todos los `OWNER` y `ADMIN` activos. Cada alerta se guarda en la tabla `alerts` con una clave
unica `order_id + stage_history_id + alert_type + recipient_user_id`, por lo que **nunca se envia
duplicada**, aunque el cron corra varias veces. Las alertas fallidas se reintentan hasta 3 veces
en ciclos posteriores.

Con `EMAIL_ENABLED=false` las alertas se escriben como log estructurado (visible en la consola de
Vercel) y se registran con canal `CONSOLE`.

Los tiempos se configuran en dias desde la seccion **SLA**, pero se almacenan en minutos.

---

## Ejecucion manual de SLA

```bash
npm run check:sla
```

Salida de ejemplo:

```text
Revision de SLA - Zorzal Lirio OS
---------------------------------
Ordenes revisadas.......: 42
Alertas warning creadas.: 3
Alertas overdue creadas.: 2
Correos enviados........: 5
Alertas en consola......: 0
Alertas fallidas........: 0
```

Termina con codigo de salida `0` si todo fue bien y distinto de `0` si fallo.
Usa el mismo `SlaCheckService` que el endpoint del cron; no existe una segunda implementacion.

---

## Pruebas

```bash
npm test
```

- `tests/unit` — reglas de dominio: formula SLA, reglas de transicion por rol, permisos,
  esquemas Zod, deduplicacion de alertas, exportacion CSV. **No requieren base de datos.**
- `tests/client` — React Testing Library: tablero, filtros, modal de transicion, indicadores
  de SLA. **No requieren base de datos.**
- `tests/api` — integracion real con Supertest sobre la app Express. **Requieren `DATABASE_URL`**
  y se omiten automaticamente si no esta definida.

Para habilitar las pruebas de integracion, apunta a una base de datos **de pruebas** (no la de
produccion), migrala, sembrala y ejecuta:

```bash
npm run db:migrate && npm run db:seed && npm test
```

Pruebas end to end con Playwright (requieren base de datos migrada y sembrada):

```bash
npx playwright install chromium
```

```bash
npm run test:e2e
```

Playwright compila y levanta la aplicacion en `http://localhost:3000`. Para probar contra un
despliegue existente:

```bash
E2E_BASE_URL=https://tu-app.vercel.app npm run test:e2e
```

---

## Build

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm run build
```

`build` compila el backend TypeScript a `dist/` y el frontend a `client/dist/`.

---

## Deploy en Vercel

1. **Sube el proyecto a GitHub.**

   ```bash
   git init && git add . && git commit -m "Zorzal Lirio OS"
   ```

   ```bash
   git remote add origin https://github.com/<usuario>/<repo>.git && git push -u origin main
   ```

2. **Importa el repositorio en Vercel** (New Project → Import Git Repository).
   `vercel.json` ya define el build del frontend, la funcion `api/index.ts` y las reescrituras;
   no hace falta tocar la configuracion de build.

3. **Conecta Neon.** En Vercel → Settings → Environment Variables agrega, para
   *Production* y *Preview*:

   ```text
   DATABASE_URL
   DATABASE_URL_UNPOOLED
   APP_URL              (por ejemplo https://zorzal-lirio-os.vercel.app)
   SESSION_SECRET
   CRON_SECRET
   NODE_ENV=production
   EMAIL_ENABLED=false
   APP_TIMEZONE=America/Tegucigalpa
   ```

4. **Ejecuta migraciones y seed** desde tu maquina apuntando a la base de produccion:

   ```bash
   npm run db:migrate
   ```

   ```bash
   NODE_ENV=production npm run db:seed
   ```

   En Windows PowerShell:

   ```bash
   $env:NODE_ENV='production'; npm run db:seed
   ```

5. **Despliega** (`git push` o el boton Deploy).

6. **Prueba de salud:**

   ```bash
   curl https://tu-app.vercel.app/api/health
   ```

7. **Prueba de login:** entra a `https://tu-app.vercel.app/login` con
   `owner@zorzallirio.local` / `owner123` y cambia la contrasena cuando se te solicite.

8. **Prueba manual del cron:**

   ```bash
   curl -H "Authorization: Bearer $CRON_SECRET" https://tu-app.vercel.app/api/cron/sla
   ```

---

## Configuracion del cron

`vercel.json` ya incluye:

```json
{
  "crons": [{ "path": "/api/cron/sla", "schedule": "0 14 * * *" }]
}
```

`0 14 * * *` (UTC) equivale a las **8:00 a. m. de Tegucigalpa**. Vercel envia automaticamente el
encabezado con `CRON_SECRET`; sin el, el endpoint responde **401**.

El proceso toma un lock con expiracion en la tabla `cron_locks`, de modo que dos ejecuciones
simultaneas no se pisan. El lock se libera siempre, incluso ante error, y expira solo si el
proceso muere.

Respuesta del endpoint:

```json
{
  "success": true,
  "checkedOrders": 42,
  "warningsCreated": 3,
  "overdueCreated": 2,
  "emailsSent": 5,
  "consoleAlerts": 0,
  "failedAlerts": 0
}
```

---

## Configuracion SMTP

SMTP es **opcional**. Para activarlo:

```env
EMAIL_ENABLED=true
SMTP_HOST=smtp.tuproveedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=notificaciones@tudominio.com
SMTP_PASS=tu-clave-de-aplicacion
SMTP_FROM="Zorzal Lirio OS <notificaciones@tudominio.com>"
```

Con `SMTP_PORT=465` usa `SMTP_SECURE=true`. Si `EMAIL_ENABLED=true` pero falta `SMTP_HOST`, la
aplicacion falla al arrancar en produccion con un mensaje explicito.

---

## API REST

Todas las respuestas usan la misma estructura:

```json
{ "success": true, "data": {}, "error": null }
```

```json
{
  "success": false,
  "data": null,
  "error": { "code": "ORDER_VERSION_CONFLICT", "message": "La orden fue modificada por otro usuario." }
}
```

| Metodo | Ruta | Rol minimo |
| --- | --- | --- |
| POST | `/api/auth/login` | publico |
| POST | `/api/auth/logout` | publico |
| GET | `/api/auth/me` | autenticado |
| POST | `/api/auth/change-password` | autenticado |
| GET | `/api/users` | autenticado (planta recibe listado reducido) |
| POST | `/api/users` | OWNER / ADMIN |
| GET | `/api/users/:id` | OWNER / ADMIN |
| PATCH | `/api/users/:id` | OWNER / ADMIN |
| POST | `/api/users/:id/reset-password` | OWNER / ADMIN |
| POST | `/api/users/:id/activate` | OWNER / ADMIN |
| POST | `/api/users/:id/deactivate` | OWNER / ADMIN |
| PUT | `/api/users/:id/stage-focus` | OWNER / ADMIN |
| GET | `/api/stages` | autenticado |
| PATCH | `/api/stages/:id/sla` | OWNER / ADMIN |
| GET | `/api/orders` | autenticado |
| POST | `/api/orders` | OWNER / ADMIN |
| GET | `/api/orders/:id` | autenticado (planta, solo las suyas) |
| PATCH | `/api/orders/:id` | OWNER / ADMIN |
| POST | `/api/orders/:id/transition` | autenticado |
| POST | `/api/orders/:id/reassign` | OWNER / ADMIN |
| POST | `/api/orders/:id/archive` | OWNER / ADMIN |
| POST | `/api/orders/:id/restore` | OWNER / ADMIN |
| GET | `/api/orders/:id/notes` | autenticado |
| POST | `/api/orders/:id/notes` | autenticado |
| POST | `/api/orders/:orderId/notes/:noteId/hide` | OWNER / ADMIN |
| GET | `/api/orders/:id/history` | autenticado |
| GET | `/api/orders/:id/audit` | OWNER / ADMIN |
| GET | `/api/reports/summary` | autenticado (planta ve solo lo suyo) |
| GET | `/api/reports/workload` | OWNER / ADMIN |
| GET | `/api/reports/overdue` | OWNER / ADMIN |
| GET | `/api/reports/stage-times` | OWNER / ADMIN |
| GET | `/api/reports/throughput` | OWNER / ADMIN |
| GET | `/api/reports/export` | OWNER / ADMIN |
| GET | `/api/cron/sla` | `Authorization: Bearer ${CRON_SECRET}` |
| GET | `/api/health` | publico |

Filtros del tablero persistidos en la URL, por ejemplo:

```text
/orders?assignee=me&sla=OVERDUE&priority=URGENT
```

---

## Consideraciones de seguridad

- Contrasenas con `bcryptjs` (12 rondas). Nunca se almacenan en texto plano.
- Sesiones en PostgreSQL: la cookie `zl_session` es `HttpOnly`, `SameSite=Lax`, `Secure` en
  produccion, y en base de datos **solo se guarda el hash** del token.
- Rotacion de sesion en cada login y **revocacion de todas las sesiones** al cambiar o
  restablecer la contrasena y al desactivar un usuario.
- Rate limit estricto en `/api/auth/login` y limite general para el resto de la API.
- Helmet con CSP, CORS restringido a `APP_URL`, compresion y limite de 256 kB en cuerpos JSON.
- Validacion Zod en cada endpoint; consultas parametrizadas via Drizzle.
- RBAC verificado en el servidor: ocultar un enlace nunca sustituye la autorizacion.
- Sin stack traces en produccion; logs estructurados con Pino y campos sensibles ocultos.
- Concurrencia optimista con `version`: si otro usuario modifico la orden, la API responde **409**
  y la interfaz recarga los datos en lugar de sobreescribirlos.
- Las ordenes y los usuarios con historial nunca se eliminan fisicamente.
- El historial nunca se sobreescribe: cada movimiento agrega un tramo nuevo.

---

## Solucion de errores comunes

**`DATABASE_URL no esta configurado`**
Falta el archivo `.env` o la variable. Copia `.env.example` a `.env` y pega la cadena de Neon.

**`Variables de entorno invalidas: DATABASE_URL es obligatorio en produccion`**
Con `NODE_ENV=production` son obligatorias `DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET` y
`APP_URL`. Definelas en Vercel → Settings → Environment Variables y vuelve a desplegar.

**`/api/health` responde `"database": "disconnected"`**
La cadena de conexion es incorrecta, le falta `?sslmode=require` o el proyecto de Neon esta
suspendido. Abre la consola de Neon para reactivarlo y vuelve a probar.

**`relation "orders" does not exist`**
Faltan las migraciones. Ejecuta `npm run db:migrate` apuntando a esa base de datos.

**Login correcto pero la aplicacion pide iniciar sesion otra vez**
`APP_URL` no coincide con el dominio real, o estas en HTTP con `NODE_ENV=production`
(la cookie `Secure` exige HTTPS). Ajusta `APP_URL` al dominio exacto.

**`La orden fue modificada por otro usuario.` (HTTP 409)**
Comportamiento esperado del control de concurrencia: alguien mas movio la orden. La interfaz
recarga los datos; repite la accion sobre la version actualizada.

**`Debes cambiar tu contrasena antes de continuar.` (HTTP 403)**
La cuenta tiene `must_change_password = true`. Entra a `/profile` y cambia la contrasena.

**El cron responde 401**
`CRON_SECRET` no coincide entre el entorno y el encabezado. En Vercel el cron lo envia solo si la
variable esta definida en el entorno del despliegue.

**`Ya hay una revision de SLA en curso.`**
Hay otra ejecucion activa. El lock expira solo a los 5 minutos; espera y repite.

**Las pruebas de `tests/api` aparecen como omitidas**
Es lo esperado sin `DATABASE_URL`. Define una base de pruebas, migrala, sembrala y vuelve a
ejecutar `npm test`.

**`npx playwright test` falla al iniciar el navegador**
Instala el navegador con `npx playwright install chromium`.
