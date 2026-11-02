# 07 · Módulos y pantallas

Un solo usuario y datos de cientos de filas: **la navegación es plana, las listas
se cargan completas y se filtran en el navegador**. El orden del menú sigue la
frecuencia de uso: primero lo que llega solo (mensajes, comentarios), después lo
que se edita a propósito.

## Mapa del menú

```
Inicio
  Panel                      /                     contadores y atajos

Bandeja            (lo que llega solo)
  Mensajes        ●3         /mensajes             globo: sin leer
  Comentarios     ●2         /comentarios          globo: pendientes

Contenido          (lo que tú escribes)
  Proyectos                  /proyectos
  Experiencia                /experiencia
  Educación                  /educacion
  Habilidades                /habilidades
  Sobre mí                   /sobre-mi

Sitio
  Medios                     /medios               biblioteca de R2
  Ajustes                    /ajustes              enlaces, WhatsApp, CV, vista previa

Sistema
  Actividad                  /actividad            historial de cambios
  Estado                     /estado               versiones y salud
  Cuenta                     /cuenta               correo, sesión, tema, salir
```

- **Escritorio:** menú lateral fijo (~240 px) con grupos; una barra superior con la
  ruta de migas, el cambio de tema y el menú de la cuenta.
- **Móvil (375 px):** el menú lateral pasa a un `Sheet` que abre un botón de menú;
  las tablas se vuelven listas de tarjetas.
- Cada ruta es una página de Astro que monta **una isla de React**
  (`client:load`); no hay SPA ni enrutador en el cliente. Navegar es una carga de
  página normal (el contenido es privado y pequeño; no hace falta más).
- El globo del menú se calcula en el **servidor** al renderizar el Layout
  (`unread-count` y comentarios pendientes) para no parpadear.

## Patrón común de módulo

Todos los módulos de **Contenido** comparten la misma estructura (una sola vez
construida, reutilizada seis veces):

| Pieza | Comportamiento |
|---|---|
| **Lista** | tabla ordenable; búsqueda por texto; filtros; contador "N de M"; esqueleto de filas mientras carga |
| **Acciones por fila** | Editar, Duplicar (copia con slug nuevo), Subir/Bajar (orden), Borrar |
| **Formulario** | página completa `/<modulo>/nuevo` y `/<modulo>/<id>`; pestañas **ES · EN · FR**; barra fija inferior con *Guardar cambios* y *Cancelar* |
| **Pestañas de idioma** | cada pestaña muestra una marca de "completa / incompleta / vacía"; el español es la base y es obligatorio; EN y FR son opcionales y caen al español |
| **Estados** | vacío (con una acción: "Crear el primer proyecto"), cargando (skeleton), error (con "Reintentar"), guardando (botón desactivado y etiqueta), guardado (aviso breve) |
| **Cambios sin guardar** | el formulario marca que está sucio, avisa al salir (`beforeunload`) y `Ctrl/⌘ + S` guarda |
| **Confirmación** | borrar siempre pide confirmación con el nombre del elemento ("Borrar «Mi proyecto»") y dice qué pasará |
| **Ver en el sitio** | enlace a la página pública del elemento (solo si está publicado) |

La edición **no es automática**: nada se guarda hasta pulsar *Guardar cambios*. Los
avisos de éxito dicen lo mismo que el botón ("Guardado"), y un error dice qué falló.

## Módulos

### Panel (`/`)

- Tarjetas con números: mensajes sin leer, comentarios pendientes, proyectos en
  borrador, última edición.
- Atajos: "Nuevo proyecto", "Subir imagen", "Ir a mensajes".
- Últimos cambios (de Actividad, fase 7) y el estado del backend.
- Todo sale de las rutas existentes (`unread-count`, listas `admin`); **no hay
  endpoint de resumen** porque son cuatro peticiones en paralelo a datos
  diminutos.

### Mensajes (`/mensajes`) — fase 2

- Bandeja de dos paneles en escritorio (lista + detalle), una pantalla a la vez en móvil.
- Filtros: **Todos · Sin leer · Leídos · Respondidos** (`?status=`).
- Detalle: nombre, correo (enlace `mailto:`), teléfono (enlace `tel:` y botón de
  WhatsApp), fecha, mensaje. Al abrir uno `unread` pasa a `read`.
- Acciones: **Marcar como respondido**, volver a **Sin leer**, **Borrar** (spam).
- Responder = abrir `mailto:` con asunto precargado; el estado lo marcas tú.
- Datos personales de terceros: no se registran en logs ni en auditoría (cap. 10).

### Comentarios (`/comentarios`) — fase 2

- Pestañas **Pendientes · Publicados · Ocultos** con contador.
- Cada tarjeta: nombre, puesto, país con su bandera, texto, fecha.
- Acciones: **Publicar**, **Ocultar**, **Volver a pendiente**. **No se edita el
  texto.** El borrado definitivo (si se agrega B7) solo desde "Ocultos".
- Atajo de teclado para revisar en lote: `J/K` mover, `P` publicar, `H` ocultar.

### Proyectos (`/proyectos`) — fase 4

- Lista: miniatura, título, slug, categoría, estado (`Borrador`/`Publicado`),
  destacado, fecha de edición. Filtros por categoría y estado; búsqueda por título.
- Formulario por secciones: **Datos** (slug, categoría, estado, destacado, fork) ·
  **Imágenes** (tarjeta, galería) · **Enlaces** (repo, web, video) · **Stack**
  (selector de tecnologías) · **Textos** (pestañas ES/EN/FR con título, resumen y
  descripción).
- El orden se cambia con subir/bajar y se guarda en lote (B6). Los destacados se
  marcan con una casilla; no tienen orden aparte.
- Un borrador **no aparece en el sitio**; publicarlo es cambiar el estado.
- Duplicar: copia la fila con `slug` + `-copia` y estado `draft`.

### Experiencia (`/experiencia`) — fase 5

Lista ordenable (logo, empresa, título, periodo). Formulario: logo (imagen) con
`alt`, empresa, título, subtítulo, periodo, ubicación; pestañas EN/FR.

### Educación (`/educacion`) — fase 5

Igual que Experiencia: logo, institución, subtítulo, descripción, periodo; EN/FR.

### Habilidades (`/habilidades`) — fase 5

Lista ordenable de grupos ("Frontend", "Backend"…). Formulario: título (ES/EN/FR) y
el selector de tecnologías (`images_topics`) con vista previa de los íconos.

### Sobre mí (`/sobre-mi`) — fase 5

Un único formulario (singleton, sin lista): imagen, título de la tarjeta,
subtítulo, descripción; pestañas EN/FR. Solo se edita, no se crea ni se borra.

### Medios (`/medios`) — fase 3

Biblioteca de R2 (cap. 05): rejilla, "dónde se usa", "Sin uso", subir y borrar.

### Ajustes (`/ajustes`) — fase 6

Un formulario con tarjetas: **Enlaces** (GitHub, LinkedIn), **Contacto** (correo,
WhatsApp con selector de país y vista previa del enlace `wa.me`), **CV** (subir PDF
y ver el actual), **Vista previa social** (imagen 1200 × 630 con simulación de
tarjeta). Un cambio aquí se refleja en Header, Footer, formulario de contacto y
JSON-LD del sitio (cuatro lugares que hoy tienen copias propias).

### Actividad (`/actividad`) — fase 7

Línea de tiempo: fecha, acción (`creó`/`editó`/`borró`), recurso y enlace al
elemento (si sigue existiendo), resumen corto. Solo lectura, últimas 1 000.

### Estado (`/estado`) — fase 1

Versión del admin, versión del backend (`GET /api`), si el backend responde, si
`ACCESS_AUD`/`ACCESS_TEAM_DOMAIN` están configurados, y la hora de expiración de la
sesión. Es la pantalla a la que ir cuando "algo no carga".

### Cuenta (`/cuenta`) — fase 1

Correo (del JWT), expiración de la sesión, **selector de tema** (Sistema/Claro/Oscuro)
y **Cerrar sesión** (cap. 04).

## Rutas de la API del admin (por módulo)

| Módulo | Ruta del admin | Backend |
|---|---|---|
| Mensajes | `GET /api/contact-messages?status=`, `PUT/DELETE /api/contact-messages/:id` | igual |
| Comentarios | `GET /api/comments`, `PUT /api/comments/:id` | `GET /comments/admin` |
| Proyectos | `GET/POST /api/projects`, `PUT/DELETE /api/projects/:id`, `PUT /api/projects/order` | `GET /projects/admin` + CRUD |
| Experiencia, Educación, Habilidades | ídem | ídem |
| Sobre mí | `GET/PUT /api/about` | `GET /about/admin`, `PUT /about` |
| Medios | `GET/POST /api/media`, `DELETE /api/media/:key` | B1–B4 |
| Ajustes | `GET/PUT /api/settings`, `POST /api/media/cv` | B2, B5 |
| Actividad | `GET /api/audit` | B9 |

Los nombres de las rutas del admin son en **inglés** (como el backend) y las
pantallas en **español**: el nombre de la URL que ve la persona no es el de la API.

## Orden dentro de las listas

Experiencia, educación, habilidades y proyectos usan `sort_order`. Se reordena con
**botones Subir/Bajar** (accesibles con teclado, sin librería de arrastrar y
soltar). La lista se reordena en pantalla y se guarda al pulsar *Guardar orden*
(un solo `PUT …/order` atómico). Arrastrar y soltar se evalúa solo si resulta
incómodo con 21 proyectos.

## Qué incluye cada pantalla de formulario (lista de comprobación)

- [ ] Un solo `<h1>`; etiquetas visibles; errores asociados con `aria-describedby`.
- [ ] Todo operable con teclado; foco visible; el orden de tabulación sigue el visual.
- [ ] Esqueleto al cargar (nunca un spinner).
- [ ] Estado vacío, de error y de guardado definidos.
- [ ] Aviso de cambios sin guardar y `Ctrl/⌘ + S`.
- [ ] Confirmación en toda acción destructiva.
- [ ] Probada en 375 px y ≥ 1280 px, claro y oscuro.
