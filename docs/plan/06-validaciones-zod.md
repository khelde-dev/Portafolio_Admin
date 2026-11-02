# 06 · Validaciones con Zod

Se valida en **tres capas**, y cada una existe por una razón distinta:

| Capa | Dónde | Para qué |
|---|---|---|
| 1. Formulario | isla de React (`react-hook-form` + `@hookform/resolvers/zod`) | que la persona vea el error junto al campo, al instante |
| 2. Ruta del admin | `src/pages/api/*` antes de llamar al backend | seguridad: nada inválido sale del Worker del admin |
| 3. Backend | `zValidator` en cada ruta de Hono | la defensa que cuenta: es la única que no se puede saltar |

Las capas 1 y 2 usan **el mismo esquema**, definido una sola vez en
`src/schemas/` y usado por el cliente y por el servidor del admin. La capa 3 es
del backend.

## Cómo no divergir del backend

Los esquemas del backend y del admin viven en repos distintos. Para que no se
separen en silencio:

1. El admin **replica** los esquemas del backend (mismos límites, mismos
   mensajes de error en español), y los endurece solo para la UX (recortar
   espacios, límites más cortos si conviene).
2. Hay **fixtures de contrato** en `tests/contracts/`: JSON de ejemplo válidos e
   inválidos por recurso. Una prueba comprueba que el esquema del admin acepta los
   válidos y rechaza los inválidos. El mismo archivo se copia al backend y su
   prueba hace lo mismo con **sus** esquemas. Si uno cambia sin el otro, falla un
   test en el repo que se quedó atrás.
3. Cuando exista un segundo consumidor del API, se evalúa publicar los esquemas
   como un paquete compartido o usar el cliente tipado de Hono (`AppType`). Hoy, un
   solo consumidor no justifica esa maquinaria.

## Convenciones

- `z.string().trim()` en todo texto libre (no se guardan espacios de más).
- Mensajes **en español**, con el nombre del campo en lenguaje de persona
  ("El título es obligatorio", no "Required").
- Un texto **vacío** en un campo opcional se envía como `null` (URLs) o se omite
  (traducciones); nunca como `""`.
- `z.url()` solo no basta: acepta `javascript:`/`data:`. Se usa el helper
  `httpUrl()` (solo `http`/`https`), igual que el backend.
- Las claves de imagen **no se escriben a mano**: salen del `ImagePicker`, pero el
  esquema las valida igual con `r2Key()` (mismas reglas que el backend).
- Los números del orden son enteros; el admin los administra con botones, no
  teclea el número.
- Todo esquema exporta su tipo con `z.infer`; los formularios y las rutas usan
  ese tipo, no uno escrito aparte.

## Helpers compartidos (`src/schemas/common.ts`)

```ts
// idea de la forma, no código final
export const httpUrl     = (m = "URL no válida") => z.url({ protocol: /^https?$/, error: m });
export const optionalUrl = httpUrl().or(z.literal("").transform(() => null)).nullable().optional();
export const r2Key       = () => z.string().min(1).max(512).refine(sinTraversal, "Clave de imagen no válida");
export const locale      = z.enum(["es", "en", "fr"]);
export const slug        = z.string().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones");
export const sortOrder   = z.number().int();
```

## El problema de `translations`

El backend **entrega** `translations` como mapa (`{ en: {…}, fr: {…} }`) y
**recibe** una lista (`[{ locale: "en", … }]`), sin `locale` repetido. Es el punto
de fallo más probable del admin, así que:

- `src/lib/translations.ts` expone `toTranslationList(map)` y
  `toTranslationMap(list)`, con pruebas de ida y vuelta (`list → map → list` da lo
  mismo, ignorando el orden).
- El formulario trabaja con el **mapa** (una pestaña por idioma); solo al enviar se
  convierte a lista.
- Una traducción cuyos campos están **todos vacíos se descarta** (no se manda
  `{ locale: "en" }` sin contenido).
- El esquema rechaza locales repetidos igual que el backend ("Idioma repetido").
- En las traducciones cada campo es opcional: lo que falta cae al valor en español.

## Esquemas por módulo

Los límites vienen de `Backend_Portafolio/src/schemas/*.ts`; lo que el admin añade
va marcado.

### Proyecto (`projectInput`)

| Campo | Regla |
|---|---|
| `slug` | `slug`; único (409 del backend). **Admin:** se sugiere desde `title_default` (sin acentos, minúsculas, guiones) y se puede editar |
| `category` | `frontend` \| `backend` \| `companies` \| `dataAnalyst` |
| `status` | `draft` \| `published` |
| `featured`, `fork` | booleano |
| `sort_order` | entero |
| `card_image` | `r2Key` obligatoria |
| `gallery` | `r2Key[]`, máx. 50 |
| `video_url`, `link_repo`, `link_web` | `httpUrl` o `null`. **Admin:** `link_repo` debería ser de `github.com`/`gitlab.com` (aviso, no bloqueo) |
| `images_topics` | `string[]`; **Admin:** cada valor debe estar en la lista de tecnologías conocidas (ver abajo), sin repetidos |
| `title_default`, `summary_default`, `description_default` | texto obligatorio. **Admin:** `summary` ≤ 200 y `title` ≤ 120 (límites de diseño de la tarjeta; el backend no los impone) |
| `translations` | lista con `locale` único y `title`/`summary`/`description` opcionales |

### Experiencia (`experienceInput`)

`sort_order`; `work_default` ≤ 100 (opcional/`null`); `title_default`,
`subtitle_default`, `time_default`, `location_default` obligatorios; `img`
`r2Key`; `alt` obligatorio (**Admin:** ≤ 160, describe la imagen, no repite el
título); traducciones con `work` (≤ 100), `title`, `subtitle`, `time`, `location`.

### Educación (`educationInput`)

`sort_order`; `institution_default`, `subtitle_default`, `description_default`,
`period_default` obligatorios; `image` `r2Key`; traducciones con `institution`
(≤ 150), `subtitle`, `description`, `period`.

### Habilidad (`skillInput`)

`sort_order`; `title_default` obligatorio; `images_topics: string[]` (mismas reglas
que en proyectos); traducciones con `title`.

### Sobre mí (`aboutInput`)

`image` `r2Key`; `title_card_default`, `subtitle_default`, `description_default`
obligatorios; traducciones con `title_card`, `subtitle`, `description`.

### Comentario (`commentStatusInput`)

Solo `{ status: "pending" | "published" | "hidden" }`. El admin **nunca** edita el
texto, el nombre ni el país de un visitante.

### Mensaje de contacto

Solo `{ status: "unread" | "read" | "replied" }` y el filtro `?status=`.

### Ajustes del sitio (`settingsInput`, fase 6)

| Campo | Regla |
|---|---|
| `github_url` | `httpUrl` con host `github.com` |
| `linkedin_url` | `httpUrl` con host `linkedin.com` o `www.linkedin.com` |
| `whatsapp_phone` | `^\+[1-9][0-9]{7,14}$` (formato internacional; se normaliza quitando espacios, guiones y paréntesis antes de validar) |
| `contact_email` | `z.email()` |
| `cv_key` | `r2Key` que termine en `.pdf`, o `null` |
| `og_image_key` | `r2Key` que termine en `.webp`, o `null` |

### Subida de archivos (`mediaUploadInput`)

`use` ∈ `card`, `gallery`, `logo`, `about`, `og`. El archivo se valida aparte (tipo,
tamaño, dimensiones: ver cap. 05); no pasa por JSON.

## Lista de tecnologías (`images_topics`)

Hoy son cadenas libres que el sitio convierte en un ícono con
`go-skill-icons.vercel.app/api/icons?i=<nombre>`. Un nombre inventado produce un
ícono roto. Por eso:

- `src/lib/techIcons.ts` mantiene la lista de nombres válidos (los que el
  servicio soporta). El campo es un **selector con búsqueda**, no un texto libre.
- Una tecnología que no está en la lista se agrega a ella con un PR (es
  infrecuente), no se teclea al vuelo.
- Cuando se autoalojen los íconos (fase 8), la lista pasa a apuntar a archivos en
  R2 y desaparece la dependencia externa.

## Errores: del backend al campo

El backend responde `400 { success:false, message:"Datos invalidos", errors:[ZodIssue] }`.
El admin los convierte para el formulario:

- `issue.path` (p. ej. `["translations", 1, "title"]`) → nombre del campo de
  `react-hook-form` (`translations.fr.title`, usando el `locale` de esa posición).
- `409` en `slug` → error en el campo `slug` ("Ya existe un proyecto con ese slug").
- Un error sin campo → aviso arriba del formulario.
- Un `500`/`503` → mensaje genérico ("No se pudo guardar. Intenta de nuevo."); el
  detalle no se muestra ni se registra.
- Los errores se asocian con `aria-describedby` y el foco va al primer campo con
  error (UI_STANDARDS §8).

## Pruebas

- Por esquema: casos válidos, cada límite en el borde, cada rechazo (URL con
  `javascript:`, clave con `..`, slug con mayúsculas, locale repetido).
- `translations`: ida y vuelta de las dos formas y descarte de traducciones vacías.
- Contrato: fixtures compartidas con el backend (arriba).
- Conversión de errores: un `ZodIssue` con ruta anidada acaba en el campo correcto.
