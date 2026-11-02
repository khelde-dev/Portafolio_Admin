# 01 · Visión, alcance y contenido estático

## Objetivo

Dejar de hacer un commit y un deploy para cambiar el contenido del portafolio.
Todo lo que hoy se edita en archivos del repo —y todo lo que ya está en la base
pero se edita a mano— debe poder cambiarse desde una pantalla, con el cambio
visible en el sitio sin redeploy (el sitio es SSR y lee del backend en cada
petición).

## Para quién es

Para una sola persona: el dueño del portafolio. Consecuencias de diseño:

- Sin roles, permisos por módulo, invitaciones ni auditoría "para terceros".
- Se prefiere **simple y robusto** a flexible: un formulario claro por recurso.
- La interfaz puede asumir un navegador moderno de escritorio (Chrome, Edge o
  Firefox) y usarse a veces desde el teléfono; debe ser **usable en 375 px**
  pero no está optimizada para flujos móviles largos.
- Los errores se explican en el propio lenguaje de la interfaz; no hay soporte
  ni "contacta al administrador".

## Qué entra (alcance)

1. **Bandeja de contacto**: leer, marcar leído/respondido, borrar spam.
2. **Moderación de comentarios**: aprobar, ocultar, volver a pendiente.
3. **Proyectos, experiencia, educación, habilidades, sobre mí**: crear, editar,
   borrar, ordenar, con las tres traducciones.
4. **Medios**: subir imágenes (siempre WebP) y el CV (PDF) a R2; biblioteca con
   uso y huérfanas.
5. **Ajustes del sitio**: enlaces sociales, correo, WhatsApp, CV, imagen de
   vista previa (hoy repartidos por el código del portafolio).
6. **Actividad**: historial de cambios hechos desde el admin.
7. **Cuenta**: quién está dentro, cambio de tema y cierre de sesión.

## Qué no entra (no-objetivos)

- Login propio, contraseñas, 2FA propia, recuperación de cuenta (lo hace Access).
- Editor de contenido en vivo ("preview" del sitio dentro del admin). Se usa un
  enlace "Ver en el sitio" a la página pública.
- Editor de texto enriquecido (WYSIWYG/Markdown). Los textos son planos, igual
  que hoy en la base.
- Envío de correos o respuestas desde el admin: "respondido" es una marca
  manual y el correo se abre con `mailto:`.
- Notificaciones push, correo automático por mensaje nuevo, tareas programadas.
  Implicaría cron, colas o correo saliente: complejidad y costo que no se
  justifican para un solo usuario. El globo de "sin leer" del menú basta.
- Analítica de visitas. Va por Cloudflare Web Analytics si algún día se quiere.
- Multiusuario, flujos de aprobación o versiones/historial de cada campo.
- Edición de la interfaz del sitio (textos de botones, `aria-label`, etc.): son
  cadenas de interfaz y siguen en `src/i18n/locales/*.json` del portafolio.

## Inventario: qué sigue estático en el portafolio

Revisado en `Portafolio` v3.13.1. "Dónde va" indica el destino en el CMS.

| Contenido | Dónde vive hoy | Dónde va | Fase |
|---|---|---|---|
| Proyectos (21), con 3 idiomas | D1 `projects` | módulo Proyectos | 4 |
| Experiencia (5) | D1 `experience` | módulo Experiencia | 5 |
| Educación (1) | D1 `education` | módulo Educación | 5 |
| Habilidades (11) | D1 `skills` | módulo Habilidades | 5 |
| Sobre mí (1) | D1 `about` | módulo Sobre mí | 5 |
| Comentarios (12) | D1 `comments` | módulo Comentarios | 2 |
| Mensajes de contacto | D1 `contact_messages` | módulo Mensajes | 2 |
| **Enlace a GitHub** | `Header.astro`, `Footer.astro`, `Form.tsx`, JSON-LD de `Layout.astro` (4 copias) | Ajustes → enlaces | 6 |
| **Enlace a LinkedIn** | mismas 4 copias | Ajustes → enlaces | 6 |
| **WhatsApp** | `Header.astro` y `Form.tsx`: **dos números distintos** | Ajustes → un solo número | 6 |
| **Correo público** | `Header.astro` (`mailto:`) | Ajustes → correo | 6 |
| **CV (PDF)** | URL de **Vercel Blob** en `Header.astro` | R2 + Ajustes → CV | 6 |
| Imagen de vista previa (`og:image`) | `public/kdl.webp` | R2 + Ajustes (opcional) | 6 |
| Textos personales del hero y del manifiesto | `src/i18n/locales/*.json` (`HEADER_*`, `MANIFESTO`, `META_*`) | **decisión abierta**, ver abajo | 8 |
| Íconos de tecnologías | servicio externo `go-skill-icons.vercel.app` por nombre | lista de nombres validada; autoalojar después | 5 / 8 |
| Retrato del hero | `src/assets/img/hero-portrait.webp` (optimizado en el build) | se queda en el repo | — |
| Logo, favicon, 404, banderas (`public/*.png/.svg`) | repo | se quedan en el repo | — |
| Cadenas de interfaz (botones, etiquetas, `aria-*`) | i18n JSON | se quedan en el repo | — |

### Riesgos que salen del inventario

1. **El CV vive en Vercel Blob.** Al borrar los proyectos de Vercel (pendiente al
   final de la migración) el enlace se rompe. **Antes de eso** hay que bajar el
   PDF y subirlo a R2 (fase 6).
2. **Dos números de WhatsApp** distintos en el sitio. Hay que decidir cuál es el
   correcto y dejar uno solo en Ajustes (ver [decisiones abiertas](./12-decisiones-abiertas.md)).
3. **Las claves de imagen antiguas** tienen formas distintas (`Backend_Task.webp`,
   `/UPVM.webp`). El backend las acepta y el portafolio las normaliza con
   `mediaUrl()`; no hay que migrarlas, pero el CMS debe **mostrarlas** bien y no
   "corregirlas" al guardar.
4. **Íconos de terceros.** `go-skill-icons.vercel.app` es una dependencia externa
   en cada tarjeta. No es urgente, pero conviene autoalojar los íconos usados
   (fase 8) y así un CSP estricto no necesita abrir ese origen.

### Textos personales del hero y el manifiesto

`HEADER_TITLE`, `HEADER_SUBTITLE`, `HEADER_ABOUT`, el texto del manifiesto y
`META_DESCRIPTION` son **contenido**, no interfaz, pero hoy cuelgan del JSON de
traducciones del sitio. Dos caminos:

- **A (recomendado, fase 8, opcional):** una tabla `site_copy` singleton con la
  misma forma que `about` (valores por defecto + `translations` en JSON). El
  portafolio los lee del backend y usa el JSON solo como respaldo.
- **B:** dejarlos en el repo. Cambian pocas veces al año y un commit pequeño
  basta.

Se decide cuando lleguen la fase 6 y 7; no bloquea nada anterior.

## Criterio de éxito

El CMS está "terminado" cuando se puede, sin abrir el editor de código:

1. publicar un proyecto nuevo con imágenes y tres idiomas;
2. cambiar el CV, el WhatsApp o un enlace social y verlo en el sitio;
3. moderar un comentario y leer un mensaje de contacto;
4. reordenar la experiencia y las habilidades;
5. ver quién cambió qué y cuándo;
6. y **no queda ningún enlace, número ni archivo personal escrito en el código
   del portafolio** (lo comprueba una prueba de higiene en ese repo).
