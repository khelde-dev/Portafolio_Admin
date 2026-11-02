# 11 · Roadmap por fases

Orden pensado para que **cada fase deje algo útil y desplegable**, y para tocar
cada repo en el orden seguro: **backend → admin → portafolio**, siempre con
cambios aditivos (cap. 03). Cada fila de PR es una rama pequeña a `dev`; el tamaño
(S/M/L) es esfuerzo relativo, no un plazo.

Convención de repos en las tablas: **B** = `Backend_Portafolio`, **A** =
`Portafolio_Admin`, **P** = `Portafolio`.

## Fase 0 — Esqueleto ✔ (v0.1.0)

Tooling, CI, tokens, cabeceras, cliente del backend, documentos. Hecho.

## Fase 1 — Identidad y cascarón (M)

**Objetivo:** poder entrar, ver tu correo, cambiar el tema y salir; ninguna
pantalla de datos aún.

| Repo | PR | Contenido |
|---|---|---|
| — | operación | Crear la aplicación de Access, política con tu correo, OTP; copiar AUD y dominio; cargar `ACCESS_*`, `ADMIN_EMAILS` y `API_SECRET_TOKEN` en admin y `ACCESS_*` en backend (cap. 04) |
| A | `feat/access` | `src/server/access.ts` (JWT), middleware, `locals.user`, usuario falso solo en `DEV`, 401/503; `Content-Type: application/json` en `DELETE`/`PUT` sin cuerpo |
| A | `feat/shell` | `AdminShell` (menú, barra, migas, salto al contenido), cambio de tema, páginas **Cuenta** (con cierre de sesión) y **Estado**; componentes shadcn pendientes; `PageHeader`, `EmptyState`, `ErrorState` |
| A | `feat/crud-base` | `translations.ts` con pruebas de ida y vuelta, `resources.ts` + manejador `/api/[resource]`, `ResourceForm`, `DataTable`, `LocaleTabs`; backend simulado para e2e |

**Aceptación:** sin sesión redirige a Access; con otro correo, rechazo; `curl` sin
cabecera → 401; Estado muestra versiones y expiración; Cuenta cierra sesión y vuelve
a pedir el código; axe sin violaciones en Cuenta y Estado.

## Fase 2 — Bandeja (M)

**Objetivo:** ya se puede **usar** el CMS a diario (lo que llega solo).

| Repo | PR | Contenido |
|---|---|---|
| B | `feat/comments-admin-extras` | `GET /comments/pending-count` (B8); opcional `DELETE /comments/:id` (B7); entradas en `routeInventory` |
| A | `feat/inbox` | módulo **Mensajes** (bandeja, filtros, estados, borrar) |
| A | `feat/comments` | módulo **Comentarios** (pestañas, publicar/ocultar) |
| A | `feat/dashboard` | **Panel** con contadores y globos del menú |

**Aceptación:** un mensaje enviado desde el formulario público aparece en la
bandeja; marcarlo respondido persiste; un comentario `pending` se publica y aparece
en el sitio; el globo del menú sube y baja; ningún dato personal en los logs.

## Fase 3 — Medios (L)

**Objetivo:** subir imágenes (siempre WebP) y no pegar claves a mano.

| Repo | PR | Contenido |
|---|---|---|
| B | `feat/media-upload` | `POST /media` (B1), `GET /media` (B3), `DELETE /media/:key` (B4), exención de `bodyLimit`/`timeout`, validación RIFF/WEBP y dimensiones, claves `<area>/<uuid>.webp`, auditoría; pruebas con R2 de Miniflare |
| A | `feat/media-convert` | `toWebp()` (canvas, redimensionado, calidad decreciente, detección de Safari), con pruebas |
| A | `feat/media-library` | módulo **Medios** y `ImagePicker` (subir o elegir) |

**Aceptación:** un PNG de 2 MB se convierte a WebP de < 400 KB y se sube; el backend
rechaza un PNG con cabecera `image/webp`; borrar una imagen en uso devuelve 409
con la lista; las huérfanas se listan.

## Fase 4 — Proyectos (L)

**Objetivo:** publicar un proyecto completo (tres idiomas, imágenes, stack) sin
tocar el repo.

| Repo | PR | Contenido |
|---|---|---|
| B | `feat/reorder` | `PUT /projects/order` y los otros tres (B6), antes de `/:id`; `db.batch` |
| A | `feat/techpicker` | `techIcons.ts` y `TechPicker` con vista previa |
| A | `feat/projects` | módulo **Proyectos** (lista, formulario por secciones, borrador/publicado, duplicar, orden, borrado con imágenes) |

**Aceptación:** crear un proyecto en borrador no lo muestra en el sitio; publicarlo
sí, en es/en/fr; un slug repetido marca el campo; reordenar persiste.

## Fase 5 — Resto del contenido (M)

| Repo | PR | Contenido |
|---|---|---|
| A | `feat/experience-education` | módulos **Experiencia** y **Educación** |
| A | `feat/skills-about` | módulos **Habilidades** y **Sobre mí** (singleton) |

**Aceptación:** cada sección del sitio se puede editar desde el admin; no queda
ningún texto de estas cinco secciones que solo se pueda cambiar con un commit.

## Fase 6 — Ajustes del sitio y CV (L, toca los tres repos)

**Objetivo:** que **no quede ningún enlace, número ni archivo personal en el
código del portafolio**.

| Repo | PR | Contenido |
|---|---|---|
| B | `feat/site-settings` | tabla `site_settings`, `GET /settings`, `GET /settings/admin`, `PUT /settings` (B5), `POST /media/cv` (B2); migración; pruebas |
| A | `feat/settings` | módulo **Ajustes** (enlaces, WhatsApp con vista previa, CV, vista previa social) |
| — | operación | **Descargar el CV de Vercel Blob y subirlo desde Ajustes**; guardar los enlaces actuales (decidir el número de WhatsApp) |
| P | `feat/site-settings` | `src/lib/settings.ts` (lee `/settings` con respaldo), Header/Footer/Form/JSON-LD usan los ajustes; el CV y `og:image` salen de R2; **prueba de higiene que prohíbe enlaces personales en `src/`** |

**Aceptación:** cambiar el WhatsApp en Ajustes cambia el botón del Header, el del
formulario y el enlace del pie; el CV descarga desde R2; con el backend caído el
sitio usa los valores de respaldo y no se rompe; el CV de Vercel Blob ya no se
referencia en ningún lado (**solo entonces** se puede borrar Vercel).

## Fase 7 — Actividad y robustez (M)

| Repo | PR | Contenido |
|---|---|---|
| B | `feat/audit-log` | tabla `audit_log`, `auditLog()` persiste con `db.batch`, retención de 1 000, `GET /audit` (B9, B11) |
| B | `feat/optimistic-update` | los `PUT` aceptan `updated_at` y responden 409 si cambió (B10) |
| A | `feat/activity` | módulo **Actividad**; manejo del 409 de edición simultánea en `ResourceForm` |

**Aceptación:** cada create/update/delete aparece en Actividad con tu correo;
editar el mismo proyecto en dos pestañas avisa en lugar de pisar.

## Fase 8 — Pulido y endurecimiento (M, opcional por partes)

| Repo | Tema | Detalle |
|---|---|---|
| A + B | Service Binding | `services` en `wrangler.jsonc` y cambio interno de `backendClient` (cap. 03) |
| A + B | Token exclusivo del admin | `API_TOKEN_ADMIN` aceptado por el backend |
| P + A | Íconos autoalojados | `images_topics` apunta a R2 y desaparece `go-skill-icons.vercel.app` |
| B + P | `site_copy` | textos del hero/manifiesto en el CMS (si se eligió el camino A del cap. 01) |
| A + P + B | CSP completo | `script-src`/`style-src` con hashes, verificado en un navegador |
| — | Dominio `khelde.dev` | `admin.`, `media.` y `api.`; hostname extra en la aplicación de Access; `workers_dev: false`; variables de build; desactivar `r2.dev` |

## Gráfico de dependencias

```
F0 ──► F1 ──► F2
        │
        ├──► F3 ──► F4 ──► F5
        │            └────────┐
        └──► F6 (usa F3) ◄────┘  ──► F7 ──► F8
```

F2 y F3 son independientes entre sí. F4 y F5 necesitan F3 (imágenes). F6
necesita F3 (CV e imagen social).

## Definición de "hecho" (toda fase)

- [ ] Rama chica desde `dev`, PR a `dev`, commits de 25–35 archivos (o uno solo si
      son menos de 25).
- [ ] `pnpm check` en 0 errores, `pnpm lint:ci` limpio, pruebas nuevas, cobertura sobre
      los pisos, `pnpm build` y el escáner del bundle limpios.
- [ ] Cada pantalla nueva: axe sin violaciones, teclado, claro/oscuro, 375 y
      ≥ 1280 px, estados vacío/error/carga/guardado.
- [ ] Si toca el backend: ruta en `routeInventory`, prueba de integración y
      migración aditiva.
- [ ] El PR dice **qué no se pudo verificar**.
- [ ] Documentación al día (este plan, `AGENTS.md`, `.env.example` si hay variables).
- [ ] Release `vX.Y.Z` al cerrar la ronda (PR de versión aparte).

## Cuándo se considera terminado el CMS

Al cerrar las fases 1–6: se puede **vivir sin el repo del portafolio** para el
contenido. Las fases 7 y 8 son robustez y lujo; se hacen cuando haga falta.
