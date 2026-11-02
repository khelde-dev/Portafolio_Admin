# 08 · UI, tema y accesibilidad

La fuente de verdad es [`docs/UI_STANDARDS.md`](../UI_STANDARDS.md) (copiado del
portafolio). Este capítulo dice **qué parte aplica al admin y cómo**, y qué cambia
porque esto es un sistema de trabajo y no una vitrina.

## Qué se hereda y qué no

| Sección de UI_STANDARDS | En el admin |
|---|---|
| §1 Principios | **Aplica.** Accesibilidad por encima de la estética; una acción primaria por bloque |
| §2 Color y temas | **Aplica íntegra.** Misma paleta "Onyx & Violet"; el violeta solo en `--primary`; ni blanco ni negro puros. El test `designTokens.test.ts` ya la hace cumplir |
| §3 Tipografía | **Aplica**, con matiz de densidad (ver abajo) |
| §4 Espaciado y layout | **Aplica** con otra rejilla (menú lateral + contenido) |
| §5 Componentes shadcn | **Aplica íntegra.** Solo primitivos de `components/ui` |
| §5.5 Hovers táctiles | **Aplica** (`hover-lift` en tarjetas, `hover-press` en botones) |
| §5.6 Skeletons | **Aplica.** Nunca spinners |
| §6 Iconografía | **Aplica.** Solo Lucide |
| §7 Animación (GSAP) | **No aplica.** No se instala GSAP |
| §8 Accesibilidad | **Aplica íntegra** |
| §9 Checklist de PR | **Aplica** (se usa tal cual) |
| §10–12 Home, hero, galaxia, manifiesto, detalle | **No aplican** |

## Densidad: sistema, no escaparate

El portafolio es editorial (cuerpo de 17 px, titulares enormes). El admin es de
trabajo: se leen tablas y se llenan formularios. Ajustes permitidos, sin salirse
del sistema:

- **Texto de interfaz:** 15–16 px en listas y formularios; el mínimo absoluto es
  **14 px** (nunca menos). El cuerpo de 17 px solo en textos largos (detalle de un
  mensaje).
- **Titulares:** Instrument Serif (`font-serif-display`) solo en el `<h1>` de cada
  pantalla, con `text-title` o `text-heading`; nada de `text-display`/`text-hero`.
  Las etiquetas y metadatos usan Geist Mono (`eyebrow`).
- **Espaciado:** más compacto que el sitio (filas de tabla de 44–48 px de alto
  para cumplir el objetivo táctil de 44 px), pero sin amontonar.
- Un solo punto focal por pantalla: la acción primaria (*Guardar cambios*, *Nuevo*).

## Estructura (layout)

```
┌───────────────┬───────────────────────────────────────────────┐
│ Khelde Admin  │  Proyectos › Editar                 ☾  tú@…  │  ← barra superior (migas, tema, cuenta)
│               ├───────────────────────────────────────────────┤
│ Inicio        │                                               │
│ Bandeja       │   <h1> Mi proyecto            [Guardar cambios]│
│ Contenido     │   ┌────────────────────────────────────────┐   │
│  · Proyectos  │   │  contenido de la página (máx. 880 px   │   │
│  · …          │   │  en formularios; ancho completo en     │   │
│ Sitio         │   │  tablas)                               │   │
│ Sistema       │   └────────────────────────────────────────┘   │
└───────────────┴───────────────────────────────────────────────┘
```

- Menú lateral de 240 px, colapsable a íconos; en móvil, `Sheet`.
- Contenido: máx. 880 px en formularios (líneas de lectura cómodas), ancho completo
  en tablas.
- Enlace "Saltar al contenido" como primer elemento enfocable.
- Un único `<h1>` por página; `<nav aria-label="Principal">`; `<main id="contenido">`.

## Componentes

### Ya disponibles (`src/components/ui/`)

`badge`, `button`, `card`, `dropdown-menu`, `input`, `label`, `select`, `sheet`,
`skeleton`, `tabs`, `textarea`.

### Por agregar con la CLI de shadcn (no copiarlos de memoria)

```bash
pnpm dlx shadcn@latest add table dialog alert-dialog checkbox switch tooltip separator scroll-area breadcrumb
```

| Componente | Uso |
|---|---|
| `table` | listas de contenido (en móvil se muestra como tarjetas) |
| `dialog` | selector de imágenes (biblioteca), vista previa |
| `alert-dialog` | **toda** confirmación destructiva |
| `checkbox`, `switch` | destacado, fork, publicado |
| `tooltip` | explicar íconos (siempre con etiqueta accesible, no solo tooltip) |
| `breadcrumb` | ruta en la barra superior |
| `separator`, `scroll-area` | orden visual |

Avisos temporales ("Guardado") con `react-hot-toast` (ya es dependencia del
portafolio y del admin), con `role="status"`. Un error que bloquea el trabajo **no**
va en un aviso que desaparece: va en la página.

### Componentes propios del admin (`src/components/`)

| Componente | Responsabilidad |
|---|---|
| `AdminShell` | menú lateral, barra superior, migas, salto al contenido |
| `PageHeader` | `<h1>`, descripción y acciones de la página |
| `DataTable` | tabla con búsqueda, filtros, orden y versión en tarjetas para móvil |
| `ResourceForm` | envoltura de `react-hook-form`: barra de guardar, aviso de cambios sin guardar, `Ctrl/⌘ + S`, mapeo de errores del backend a campos |
| `LocaleTabs` | pestañas ES/EN/FR con estado de completitud |
| `ImagePicker` | subir (con conversión a WebP) o elegir de la biblioteca |
| `TechPicker` | selector de tecnologías con vista previa del ícono |
| `ConfirmDelete` | `alert-dialog` con el nombre del elemento |
| `EmptyState`, `ErrorState` | estados vacío y de error con su acción |
| `StatusBadge` | estado con **texto + forma**, no solo color |

## Cambio de tema

- Tres opciones en **Cuenta** y un atajo en la barra superior: **Sistema** (por
  defecto), **Claro** y **Oscuro**.
- Mecanismo idéntico al portafolio: la clase `dark` en `<html>`, preferencia en
  `localStorage["theme"]` (`"light"` | `"dark"`; ausente = sistema). Un script en
  línea en el `<head>` la aplica **antes del primer pintado** (sin parpadeo), y ya
  está en `Layout.astro`.
- Con "Sistema", el tema sigue en vivo los cambios del sistema operativo
  (`matchMedia("(prefers-color-scheme: dark)")`).
- `<meta name="color-scheme" content="light dark">` para que los controles nativos
  y las barras de desplazamiento sigan el tema.
- Todo color sale de tokens; no hay un solo `dark:` con hex. Las superficies
  suben `fondo < card < muted` en oscuro (UI_STANDARDS §2).
- El almacenamiento falla en silencio (modo privado): si no se puede leer o
  escribir, se usa el tema del sistema, sin error.
- El tema es lo **único** que el admin guarda en el navegador.

## Animación (mínima, a propósito)

- **Sí:** transiciones de 150–260 ms en hover/foco (`hover-lift`, `hover-press`),
  apertura de diálogos y hojas, esqueletos de carga con pulso suave.
- **No:** parallax, escenas fijadas, revelados por scroll, contadores animados,
  transiciones de página. Nada que se mueva solo.
- Todo respeta `prefers-reduced-motion: reduce` (sin traslaciones; la opacidad
  basta).
- Prohibido `animate-spin`, `Loader2`, `LoaderCircle` (esqueletos).

## Accesibilidad (WCAG 2.1 AA)

Es más importante aquí que en el sitio: **un CMS es formularios y tablas**.

- Contraste ≥ 4.5:1 en texto y ≥ 3:1 en controles y foco, en **ambos** temas
  (medido en los tokens; el test existente lo verifica).
- Todo operable con teclado: tablas, menús, diálogos con **trampa de foco** y
  retorno del foco al cerrar (lo da Base UI), pestañas de idioma con flechas.
- Etiquetas **visibles** en cada campo (no solo `placeholder`); ayuda y errores con
  `aria-describedby`; `aria-invalid` en campos con error; al fallar el envío, el
  foco va al primer error y se anuncia un resumen.
- Estados con texto, no solo color: una insignia "Borrador" lleva la palabra.
- Tablas con `<caption>` o `aria-label`, `<th scope>` y orden anunciado
  (`aria-sort`).
- Avisos con `role="status"`/`aria-live="polite"`; errores bloqueantes con
  `role="alert"`.
- Objetivos táctiles ≥ 44 px; `lang="es"` en `<html>`.
- Imágenes de la biblioteca con `alt` (el nombre del uso o "sin descripción"); las
  decorativas, `alt=""`.
- Verificación automática: **axe** en cada pantalla dentro de Playwright; la
  revisión manual de teclado va en el checklist del PR.

## Responsivo

- Se diseña de 375 px hacia arriba. En móvil: menú en `Sheet`, tablas como
  tarjetas apiladas, barra de guardar fija abajo, pestañas de idioma con
  desplazamiento horizontal.
- Sin desplazamiento horizontal de la página (solo dentro de una tabla ancha si
  fuera inevitable, con su propio contenedor enfocable).
- Se prueba en 375, 768 y ≥ 1280 px.

## Copia de interfaz (texto)

- Español, voz activa, verbos concretos: **Guardar cambios**, no *Enviar*;
  **Borrar proyecto**, no *Aceptar*.
- La misma acción se llama igual en todo el sitio (el botón *Publicar* produce el
  aviso *Publicado*).
- Los errores dicen **qué falló y cómo arreglarlo**, sin disculpas ni jerga técnica:
  "El slug ya existe. Elige otro" en lugar de "Error 409".
- Los vacíos invitan a actuar: "Todavía no hay proyectos. Crea el primero."
- Las fechas se muestran en la zona horaria del navegador, formato
  `2 nov 2026, 14:05`; los textos de la base están en UTC.
