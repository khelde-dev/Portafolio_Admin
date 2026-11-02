# 03 · Backend y conexión

## Flujo de una petición

```
Navegador (tú)                       Worker "portafolio-admin"                    Worker "backend-portafolio"
─────────────                        ─────────────────────────                    ───────────────────────────
GET /proyectos  ──► Access ──────►   middleware: cabeceras + JWT
                    (login)          página SSR (HTML + isla)
isla: fetch("/api/projects")  ────►  ruta /api/projects (mismo origen)
                                      1. verifica JWT y correo
                                      2. mismo origen + JSON + tamaño
                                      3. valida el cuerpo con Zod
                                      4. backendClient.callBackend(...)  ────►   bearerAuth(API_TOKEN)
                                         Authorization: Bearer <token>            accessAuth (verifica el JWT otra vez)
                                         Cf-Access-Jwt-Assertion: <jwt>           zValidator → controlador → D1 / R2
                                         Content-Type: application/json           auditLog
                                      5. devuelve JSON limpio  ◄────────────────  { success, data }
```

Reglas que no se rompen:

1. **El navegador nunca llama al backend.** Solo a `/api/*` del admin. Por eso el
   backend no necesita CORS para el admin y el token no sale del Worker.
2. **Tres puertas en serie** (Access → admin → backend): cada una verifica de
   nuevo; ninguna confía en la anterior.
3. **El admin no escribe en D1 ni en R2.** El backend es el único escritor, así
   hay un solo lugar con validación, auditoría y reglas.
4. **Todo cuerpo se valida dos veces:** en el formulario (UX) y en la ruta del
   admin (seguridad) antes de reenviarlo; el backend valida una tercera vez.

## Lo que el backend expone hoy

Fuente: `tests/security/routeInventory.test.ts` de `Backend_Portafolio` (la
política de acceso que su propio test hace cumplir). Prefijo `/api`.

### Lectura pública (bearer; la usa el sitio)

`GET /projects`, `/experiences`, `/education`, `/skills`, `/about`, `/comments`
(solo `published`), `?currentLocale=es|en|fr` resuelve el idioma con respaldo
al español. `POST /comments` y `POST /contact-messages` son públicos (con rate
limit de 5 por minuto por IP).

### CMS (bearer + Access)

| Recurso | Listar (completo) | Crear | Editar | Borrar | Otros |
|---|---|---|---|---|---|
| `projects` | `GET /projects/admin` | `POST /projects` | `PUT /projects/:id` | `DELETE /projects/:id` | |
| `experiences` | `GET /experiences/admin` | `POST` | `PUT /:id` | `DELETE /:id` | |
| `education` | `GET /education/admin` | `POST` | `PUT /:id` | `DELETE /:id` | |
| `skills` | `GET /skills/admin` | `POST` | `PUT /:id` | `DELETE /:id` | |
| `about` | `GET /about/admin` | — | `PUT /about` (singleton) | — | |
| `comments` | `GET /comments/admin` | — | `PUT /comments/:id` (`{status}`) | — | |
| `contact-messages` | `GET /contact-messages?status=` | — | `PUT /:id` (`{status}`) | `DELETE /:id` | `GET /contact-messages/unread-count` |

Forma de las respuestas:

- Éxito: `{ "success": true, "data": …, "message"?: "…" }`.
- Error de validación: `400 { "success": false, "message": "Datos invalidos", "errors": [ZodIssue…] }`.
- Otros errores: `{ "success": false, "message": "…" }` con 401, 403, 404, 409
  (slug repetido), 429, 500 o 503 (Access sin configurar).
- Los `GET …/admin` devuelven la fila con los JSON ya parseados y
  `translations` como **mapa** (`{ en: {…}, fr: {…} }`); en cambio los `POST` y
  `PUT` esperan `translations` como **lista** (`[{ locale: "en", … }]`). El admin
  convierte entre ambas formas en un solo módulo (`src/lib/translations.ts`) con
  pruebas, porque es la fuente de errores más probable (cap. 06).

### Requisitos de transporte (importan al construir el cliente)

- **`Content-Type: application/json` en cada escritura, incluso un `DELETE` sin
  cuerpo.** El middleware CSRF de Hono trata una petición sin tipo como
  `text/plain` y la rechaza si además no trae `Origin`. `backendClient` ya manda
  la cabecera cuando hay cuerpo; **hay que mandarla también en `DELETE` y `PUT`
  sin cuerpo** (hoy solo la pone si `body !== undefined`: se corrige en la fase 1).
- **Límite de cuerpo: 50 KB** para todo el API, y **10 s** de tiempo máximo por
  petición. Suficiente para formularios; **no** para imágenes (ver abajo).
- **CORS:** el backend solo permite `GET, POST, PUT, DELETE, OPTIONS` desde
  `ALLOWED_ORIGINS`. No hay `PATCH`: los cambios parciales son `PUT`.
- **ETag** activo en todo: las lecturas del admin deben pedirse con
  `cache: "no-store"` para no ver datos viejos tras una edición.

## Lo que falta en el backend

Todo se construye en `Backend_Portafolio` (PR propio, con su prueba de
integración y su entrada en `routeInventory`) **antes** de la pantalla que lo
use. Ninguna es opcional salvo donde se indica.

| # | Endpoint | Para qué | Fase | Detalle |
|---|---|---|---|---|
| B1 | `POST /media` | subir una imagen WebP | 3 | cuerpo binario `Content-Type: image/webp` (no multipart: el CSRF de Hono bloquea los formularios); límite propio (2 MiB); el servidor genera la clave; devuelve `{ key, url, size, width, height }`. Ver cap. 05 |
| B2 | `POST /media/cv` | subir el PDF del CV | 6 | `application/pdf`, ≤ 5 MiB, cabecera `%PDF-` |
| B3 | `GET /media` | listar objetos del bucket con su uso | 3 | `R2.list()` + referencias en las tablas |
| B4 | `DELETE /media/:key` | borrar una imagen | 3 | **409 si alguna fila la usa**; la clave va codificada |
| B5 | `GET /settings`, `GET /settings/admin`, `PUT /settings` | ajustes del sitio | 6 | tabla `site_settings`; el `GET` público lo lee el portafolio |
| B6 | `PUT /projects/order`, `/experiences/order`, `/education/order`, `/skills/order` | reordenar de una vez | 5 | cuerpo `[{ id, sort_order }]`; `db.batch` atómico; registradas **antes** de `/:id` |
| B7 | `DELETE /comments/:id` | borrar un comentario | 2 | opcional: ocultar casi siempre basta |
| B8 | `GET /comments/pending-count` | globo del menú | 2 | análogo a `unread-count` |
| B9 | `GET /audit` | pantalla de Actividad | 7 | últimas N filas de `audit_log` |
| B10 | `PUT` con `updated_at` | detectar edición simultánea | 7 | 409 si cambió |
| B11 | `audit_log` desde `auditLog()` | persistir el historial | 7 | hoy solo `console.log` |

### Ajustes de configuración del backend

- `bodyLimit` y `timeout` globales **no deben aplicarse** a `/media/*`: el límite
  de cuerpo de 50 KB bloquearía toda imagen. Se registran antes del límite global
  o se excluye la ruta, con un tope propio de 2 MiB y un timeout de 30 s.
- `ACCESS_AUD` y `ACCESS_TEAM_DOMAIN` del backend deben ser los de la **aplicación
  de Access del admin** (ver cap. 04). El backend no se protege con Access.
- `ALLOWED_ORIGINS` solo se amplía si algún día el navegador llama directo al
  backend, lo cual este plan prohíbe. `http://localhost:4322` ya está para
  desarrollo.
- Valor opcional **`ADMIN_EMAILS`** (lista): defensa en profundidad. Aunque la
  política de Access sea correcta, el backend rechaza un JWT cuyo correo no esté
  en la lista.

## Rutas del admin (`/api/*`, mismo origen)

Una sola tabla en `src/server/resources.ts` define qué se puede hacer, en lugar
de un archivo por recurso:

```ts
// idea (no es código final)
const RESOURCES = {
  projects:   { path: "/projects",         methods: ["GET","POST","PUT","DELETE"], schema: projectInput },
  experiences:{ path: "/experiences",      methods: ["GET","POST","PUT","DELETE"], schema: experienceInput },
  comments:   { path: "/comments",         methods: ["GET","PUT"],                 schema: commentStatus },
  // …
};
```

Un manejador `src/pages/api/[resource]/[...rest].ts` hace, en este orden:

1. recurso y método **en la lista blanca** (si no, 404/405);
2. identidad: usuario de `locals` (puesto por el middleware);
3. mismo origen (`Origin`/`Sec-Fetch-Site`) para métodos que escriben;
4. `Content-Type: application/json` y tope de tamaño;
5. cuerpo validado con el esquema del recurso (Zod) → 400 con errores por campo;
6. `callBackend()` con el JWT de la petición;
7. error del backend → mensaje genérico, conservando el estado (400/404/409) y los
   errores por campo; el cuerpo crudo del backend **nunca** llega al navegador ni
   a los logs.

## Cliente del backend (`src/server/backendClient.ts`)

Ya existe (v0.1.0). Cambios previstos:

- Mandar siempre `Content-Type: application/json` en métodos que escriben.
- Soporte para subir binarios (`body` como `ArrayBuffer`/`ReadableStream` y tipo
  explícito) para `/media`.
- Opción de **Service Binding** (`env.BACKEND.fetch`) en lugar de la URL pública.
  Es la mejor práctica en Cloudflare: el tráfico no sale a internet, no hay
  `workers.dev` que exponer y el backend puede, más adelante, rechazar la URL
  pública para las rutas del CMS. Se cambia la implementación interna; las
  pruebas y los llamadores no cambian.
- **Verificación de versión:** `GET /api` devuelve `version`; la pantalla "Estado"
  la muestra y avisa si es menor a la que el admin necesita (así un admin nuevo
  no habla con un backend viejo sin enterarse).

## Token compartido

Hoy un solo `API_TOKEN` (secreto del backend) lo usan el proxy del portafolio y
lo usará el admin. Es aceptable porque las rutas del CMS exigen **además** Access.
Endurecimiento opcional (fase 8): un segundo token exclusivo del admin
(`API_TOKEN_ADMIN`), de modo que se pueda **rotar o revocar uno sin tocar el
otro**. Requiere que el backend acepte una lista de tokens.

Rotación (sea uno o dos): cambiar el secreto en el backend y en el Worker
correspondiente en el mismo rato (`wrangler secret put`), verificar y listo. Nunca
va en el repo, en `.env.example` ni en el chat.

## Orden de despliegue entre repos

Siempre de abajo hacia arriba y solo cambios **aditivos** en el backend:

1. Backend: nueva ruta/tabla (compatible hacia atrás) → desplegar.
2. Admin: pantalla que la usa → desplegar.
3. Portafolio: si lee algo nuevo (ajustes), con valores de respaldo → desplegar.

Si un paso falla, los anteriores siguen siendo válidos porque nada se quitó.
