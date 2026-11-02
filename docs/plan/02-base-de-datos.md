# 02 · Base de datos

La base es **Cloudflare D1** (SQLite) de `Backend_Portafolio`
(`portafolio-db`, migraciones Drizzle en `drizzle/`). **El admin no se conecta a
la base**: ni binding, ni credenciales, ni SQL. Toda lectura y escritura pasa por
la API del backend. Este capítulo describe qué hay, qué se usa, qué no y qué se
agrega, porque el CMS condiciona el diseño de las tablas.

## Resumen: qué tablas se ocupan y cuáles no

| Tabla | Filas hoy | ¿Se usa en el CMS? | Módulo | Notas |
|---|---|---|---|---|
| `projects` | 21 | **Sí** | Proyectos | CRUD completo, borradores, destacados |
| `experience` | 5 | **Sí** | Experiencia | CRUD y orden |
| `education` | 1 | **Sí** | Educación | CRUD y orden |
| `skills` | 11 | **Sí** | Habilidades | CRUD y orden |
| `about` | 1 | **Sí** | Sobre mí | singleton: solo `PUT` |
| `comments` | 12 | **Sí** | Comentarios | moderación por estado; hoy sin `DELETE` |
| `contact_messages` | 0 | **Sí** | Mensajes | bandeja: leer, estado, borrar |
| `users` | — | **No** (no existe en D1) | — | la reemplaza Cloudflare Access |
| `*_translations` (5 tablas) | — | **No** (no existen en D1) | — | ahora son la columna JSON `translations` |
| `__drizzle_migrations` (Turso) | — | **No** | — | D1 usa su propia `d1_migrations` |
| `site_settings` | — | **Sí, nueva** | Ajustes | fase 6 |
| `audit_log` | — | **Sí, nueva** | Actividad | fase 7 |
| `site_copy` | — | **Opcional, nueva** | Ajustes | fase 8 (ver cap. 01) |
| `media_assets` | — | **No, descartada** | Medios | se deriva de R2 + referencias |

Las cantidades salen del respaldo de Turso del 2026-11-02
(`backups/turso/2026-11-02T02-00-49-117Z`, en el repo del backend, ignorado por
git). Con cientos de filas como mucho **no se necesita paginación del lado del
servidor, ni índices extra, ni caché**: la lista completa viaja en una sola
respuesta y se filtra y ordena en el navegador.

## La tabla de usuarios

**Ya no se usa y no se recrea.**

- En Turso existía `users` (1 fila) con contraseña (Argon2id) para el login del
  panel viejo. Está en el respaldo, **no se migró a D1** (el esquema de D1 tiene
  solo las siete tablas de contenido).
- El backend ya lo asume: `accessAuth` verifica el JWT de Cloudflare Access y la
  documentación del middleware dice textualmente "no hay contraseñas ni tabla de
  usuarios". El correo del JWT es lo único que se guarda, y solo en el log de
  auditoría.
- Consecuencias: no hay hashes que proteger, ni rotación de contraseñas, ni
  rutas `/auth/login`. Cualquier PR que proponga una tabla de usuarios se
  rechaza salvo que cambie el modelo de identidad a propósito.
- **Pendiente de higiene:** cuando se borre la base de Turso, el archivo
  `users.json` del respaldo contiene un hash de contraseña; no debe salir del
  disco local (la carpeta `backups/` ya está en `.gitignore`).

## Las tablas de contenido en detalle

Convenciones comunes (definidas en `src/schemas/common.ts` del backend):

- `id` entero autoincremental (en `about` es fijo = 1).
- `created_at` / `updated_at`: texto `YYYY-MM-DD HH:MM:SS` generado por
  `current_timestamp`, **en UTC**. El admin los muestra convertidos a la zona
  horaria del navegador y nunca los envía al guardar (el backend los pone).
- `sort_order` entero, ascendente; desempate por `id`.
- `translations`: texto JSON `{ "en": {…}, "fr": {…} }`. Lo que no está traducido
  cae al valor `*_default` (español). Se lee con `parseJson` y un valor de
  respaldo `{}`, así un JSON dañado nunca rompe el sitio.
- Imágenes: **claves de R2**, nunca URLs completas. La URL base es la variable
  `PUBLIC_MEDIA_URL`, por eso cambiar el dominio de medios no toca ninguna fila.
- Sin llaves foráneas: las tablas no se relacionan entre sí. Borrar una fila no
  tiene cascadas.

### `projects`

| Columna | Tipo | Regla | En el formulario |
|---|---|---|---|
| `slug` | texto único | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, ≤ 100 | se sugiere desde el título; editable; 409 si ya existe |
| `category` | enum | `frontend`, `backend`, `companies`, `dataAnalyst` | selector |
| `status` | enum | `draft`, `published` (por defecto `published`) | interruptor "Publicado" |
| `featured` | booleano | | casilla |
| `sort_order` | entero | | botones subir/bajar en la lista |
| `card_image` | clave R2 | obligatoria | selector de imagen |
| `gallery` | JSON `string[]` | ≤ 50 claves | lista de imágenes |
| `video_url` | URL http(s) o `null` | | campo opcional |
| `images_topics` | JSON `string[]` | nombres de tecnología | selector de etiquetas (stack) |
| `link_repo`, `link_web` | URL http(s) o `null` | | campos opcionales |
| `fork` | booleano | | casilla |
| `title_default`, `summary_default`, `description_default` | texto | obligatorios (español) | pestaña ES |
| `translations` | JSON | `{en:{title,summary,description}, fr:{…}}` | pestañas EN y FR |

El sitio público **solo** devuelve los `published`; el CMS ve todos.

### `experience`

`sort_order`, `work_default` (≤ 100, opcional: nombre de la empresa), `title_default`,
`subtitle_default`, `img` (clave R2), `alt` (texto alternativo de la imagen,
**obligatorio** y no traducible hoy), `time_default`, `location_default`,
`translations` con `work, title, subtitle, time, location`.

> El `alt` no se traduce porque el esquema no lo contempla. Es una limitación
> menor; si molesta se resuelve en el backend (agregar `alt` a la traducción) y
> luego aquí.

### `education`

`sort_order`, `institution_default`, `subtitle_default`, `description_default`,
`image` (clave R2), `period_default`, `translations` con
`institution (≤150), subtitle, description, period`.

### `skills`

`sort_order`, `title_default`, `images_topics` (JSON `string[]`: nombres de
tecnología que el sitio convierte en íconos), `translations` con `title`.

### `about` (singleton, `id = 1`)

`image`, `title_card_default`, `subtitle_default`, `description_default`,
`translations` con `title_card, subtitle, description`. Solo `GET /about/admin`
y `PUT /about`: no se crea ni se borra.

### `comments`

`name`, `job` (opcional), `description` (14–500), `direction` (`left`|`bottom`,
la asigna el backend alternando al crear), `country`, `country_flag`, `status`
(`pending` | `published` | `hidden`; todo comentario público nace `pending`).

El CMS **solo cambia el estado**: no edita el texto de un visitante. Hoy no hay
`DELETE /comments/:id`; ocultar (`hidden`) cumple casi siempre. Si se quiere
borrar de verdad (spam, datos personales), se agrega la ruta en el backend
(fase 2) y el borrado pide confirmación.

### `contact_messages`

`name`, `email`, `phone` (7–20), `more_information` (≤ 1000, opcional),
`status` (`unread` → `read` → `replied`), `replied_at`. Hay 0 filas porque el
formulario es nuevo (reemplazó a Telegram). Contiene **datos personales de
terceros**: ver [seguridad](./10-seguridad-y-riesgos.md#datos-personales).

## Tablas nuevas (propuestas)

Todas se crean en el **backend** (esquema Drizzle + migración + ruta + pruebas) y
solo después el admin las usa. Una por PR.

### `site_settings` (fase 6) — singleton, `id = 1`

Reúne los datos que hoy están repetidos en el código del portafolio.

| Columna | Tipo | Regla |
|---|---|---|
| `github_url` | texto | URL http(s), `https://github.com/…` |
| `linkedin_url` | texto | URL http(s) de `linkedin.com` |
| `whatsapp_phone` | texto | E.164: `^\+[1-9][0-9]{7,14}$`; el sitio arma `https://wa.me/<dígitos>` |
| `contact_email` | texto | correo válido; el sitio arma `mailto:` |
| `cv_key` | texto nulo | clave R2 de un PDF (`site/cv-….pdf`) |
| `og_image_key` | texto nulo | clave R2 WebP para la vista previa social |
| `created_at`, `updated_at` | texto | como las demás |

- Sin traducciones: son datos, no texto de interfaz.
- Una variante con **un CV por idioma** (`cv_key_es`, `cv_key_en`, `cv_key_fr`) es
  posible; hoy hay un solo CV, así que empieza con uno ([decisión abierta](./12-decisiones-abiertas.md)).
- El portafolio lee `GET /settings` (público, con bearer) y, si falla, usa valores
  de respaldo para no romper el pie ni el hero.

### `audit_log` (fase 7)

Hoy `auditLog()` solo escribe una línea en consola; los logs de Workers tienen
retención corta. Para saber "qué cambié y cuándo" hace falta persistirlo.

| Columna | Tipo | Nota |
|---|---|---|
| `id` | entero autoincremental | |
| `at` | texto | `current_timestamp` (UTC) |
| `admin_email` | texto | del JWT (`email`, o `common_name` si no hay) |
| `action` | enum | `create`, `update`, `delete` |
| `resource` | texto | `projects`, `comments`, … |
| `resource_id` | texto | id, o `1` en singletons |
| `summary` | texto nulo | frase corta ("título: A → B"), **sin contenido completo** |

- Solo se escribe desde el backend (en la misma petición, con `db.batch`).
- Retención: conservar las **últimas 1 000 filas** (borrar las más viejas al
  insertar). Para un solo usuario es historial de sobra y el tamaño es
  despreciable.
- No se guardan cuerpos completos ni datos personales de mensajes de contacto.

### `site_copy` (fase 8, opcional)

Singleton con la misma forma que `about` (campos `*_default` + `translations`)
para el texto del hero y del manifiesto. Solo si se elige el camino A del
[cap. 01](./01-vision-y-alcance.md#textos-personales-del-hero-y-el-manifiesto).

### `media_assets`: descartada

Una tabla que "registre" lo subido a R2 se desincroniza (alguien borra desde el
panel de Cloudflare, falla una subida a medias). En su lugar:

- **Qué hay** = `R2.list()` (cientos de objetos como mucho).
- **Qué se usa** = recorrer las columnas de imagen de las siete tablas
  (`card_image`, `gallery`, `img`, `image`, `cv_key`, `og_image_key`).
- **Huérfanas** = lo primero menos lo segundo. La pantalla de Medios lo calcula
  bajo demanda; no hay que mantener un registro.

## Reglas de escritura

- **Una escritura por recurso.** D1 no tiene transacciones interactivas; las
  traducciones viven en la misma fila justamente para que una edición sea una
  sola sentencia atómica. Cuando haga falta más de una (p. ej. fila + auditoría),
  `db.batch([...])` las ejecuta de forma atómica.
- **El `PUT` reemplaza la fila completa** con lo enviado (no es un `PATCH`). El
  formulario siempre manda el objeto completo; un campo omitido vuelve a su valor
  por defecto. Por eso el admin carga el registro entero antes de editar.
- **Conflicto de slug** → el backend responde 409 y el formulario lo muestra en
  el campo `slug`.
- **Edición simultánea:** hay un solo usuario, pero dos pestañas abiertas pueden
  pisarse. Mitigación barata en la fase 7: el `PUT` recibe el `updated_at` leído
  y el backend responde 409 si cambió.
- **Borrado** de proyectos, experiencia, etc.: confirmación explícita y, si la
  fila tiene imágenes que ningún otro registro usa, ofrecer borrarlas de R2.

## Migraciones y cambios de esquema

1. Se cambia el esquema en `Backend_Portafolio/src/schemas/*.ts`.
2. `bun run db:generate` crea el SQL en `drizzle/`.
3. `wrangler d1 migrations apply portafolio-db --remote` lo aplica (primero con
   `--local` y las pruebas de integración, que levantan una D1 en memoria).
4. El script `db:drift` del backend falla en CI si el esquema y las migraciones
   no coinciden.

**Regla:** las migraciones son **aditivas** (tablas o columnas nuevas con valor
por defecto). Nada de borrar o renombrar columnas en uso sin una fase de
transición, porque el portafolio y el admin se despliegan por separado.

## Respaldos y recuperación

- **Time Travel de D1**: restauración a un punto en el tiempo
  (`wrangler d1 time-travel restore`). La ventana depende del plan **[verificar]**.
- **Exportación manual** antes de cada cambio grande:
  `wrangler d1 export portafolio-db --remote --output=backups/d1-AAAA-MM-DD.sql`.
  `backups/` y `*.sql` están en `.gitignore` en los tres repos: **un respaldo
  nunca se sube a GitHub** (hay datos personales de mensajes y comentarios).
- **R2** no tiene "papelera": un borrado es definitivo. Por eso el borrado de
  imágenes va con confirmación y con verificación de que ninguna fila la usa
  (ver [cap. 05](./05-imagenes-r2.md)).
- Una vez al mes, anotar la exportación y probar que se puede importar a una D1
  local. Sin probar, un respaldo es una esperanza.

## Límites que importan

D1 admite miles de millones de filas y bases de hasta 10 GB; aquí el volumen es
de cientos de filas. Los límites que sí se pueden alcanzar son de **forma**, no
de tamaño: una fila de proyecto con tres descripciones largas ronda los pocos KB
y el backend limita el cuerpo de un `PUT` a **50 KB** (`bodyLimit`); sobra. Las
subidas de imagen tienen su propia ruta y su propio límite (cap. 05).
