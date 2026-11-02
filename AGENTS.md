# AGENTS.md — Instrucciones para agentes e IAs

Este archivo lo leen automáticamente los agentes de código que trabajan en
este repositorio (Claude Code, Codex, Cursor, Copilot, etc.). `CLAUDE.md`
solo lo importa. Las reglas de aquí son **obligatorias**, no sugerencias.

## Proyecto

Panel de administración (CMS) del portafolio de Erick González
(`muke78/Portafolio_Admin`).

- Astro 7 en modo SSR (`output: "server"`) con islas de React 18,
  desplegado en Cloudflare Workers (ver Infraestructura).
- Tailwind CSS v4 (CSS-first) + shadcn/ui sobre Base UI. Misma paleta y
  mismos primitivos que el portafolio público.
- Edita el contenido que sirve `Backend_Portafolio` (Worker de Hono +
  Cloudflare D1 + R2). Este repo **no tiene base de datos propia**.
- **Sin pantalla de login.** La identidad la resuelve Cloudflare Access antes
  de que la petición llegue al Worker; el admin solo verifica el JWT que Access
  le manda. No crees formularios de usuario/contraseña, sesiones ni cookies de
  autenticación.
- El panel está en español (un solo idioma): no hay i18n.
- Arquitectura completa, flujo de una petición y hoja de ruta en
  [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md). Léela antes de crear una
  pantalla, una ruta `/api/*` o una carpeta nueva.

## Infraestructura

Todo el stack vive en **Cloudflare** (V8 isolates, sin contenedores):

| Pieza | Servicio |
|---|---|
| Admin (este repo, Astro SSR) | **Cloudflare Workers** (`@astrojs/cloudflare`), Worker `admin-portafolio` |
| Puerta de entrada | **Cloudflare Access** (Zero Trust) delante del Worker |
| API de contenido (`Backend_Portafolio`) | **Worker de Hono** |
| Base de datos | **Cloudflare D1** (la usa el backend) |
| Imágenes y archivos | **Cloudflare R2** (la usa el backend) |

- Config del Worker: `wrangler.jsonc`. **Toda URL es una variable**, declarada
  una sola vez en `env.schema` de `astro.config.mjs` (con valor por defecto
  cuando es pública) y documentada en `.env.example`:

  | Variable | Contexto | Para qué |
  |---|---|---|
  | `BACKEND_URL` | servidor, pública | base de la API de contenido |
  | `API_SECRET_TOKEN` | servidor, **secreta** | bearer hacia el backend (`wrangler secret put`) |
  | `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` | servidor, pública | verificar el JWT de Access |
  | `PUBLIC_MEDIA_URL` | cliente (build) | origen público de R2; solo vía `src/lib/media.ts` |
  | `PUBLIC_PORTFOLIO_URL` | cliente (build) | enlaces al portafolio público |

  No escribas esas URLs en componentes ni en el código: al comprar el dominio
  solo cambian estas variables. Un test (`tests/unit/hygiene.test.ts`) falla si
  aparece una URL de `workers.dev`, `r2.dev` o `khelde.` fuera de la config.
- **CI/CD en GitHub Actions** (`.github/workflows/`): `ci-dev.yml` valida
  los PRs a `dev` (Biome, `astro check`, Vitest con cobertura, build) y
  `ci-main.yml` los PRs a `main` (lo mismo + Playwright y auditoría estricta).
  `security.yml` corre CodeQL, gitleaks y dependency review. El deploy lo hace
  la integración Git de Cloudflare (Workers Builds) al hacer push a `main`; el
  job de Actions (`wrangler deploy`) queda comentado en `ci-main.yml` como
  alternativa.
- **No se despliega nada con datos reales sin Cloudflare Access activo.** El
  Worker no tiene login propio: sin Access delante, cualquiera que conozca la
  URL entraría. Por eso `preview_urls` está en `false` y no hay rutas que
  funcionen sin un JWT válido (en producción).

## Comandos

```bash
pnpm dev               # servidor de desarrollo en http://localhost:4322
pnpm check             # astro check (tipos); debe quedar en 0 errores
pnpm check:biome       # Biome: formato + lint (con --write)
pnpm build             # build de producción
pnpm test:unit         # Vitest
pnpm test:unit:coverage # Vitest con cobertura (pisos en vitest.config.ts)
pnpm test:e2e          # Playwright (levanta el servidor si no está corriendo)
```

Gestor de paquetes: **pnpm**. No uses npm ni yarn.
El puerto es **4322** (el portafolio usa 4321): los dos pueden correr a la vez.

## Flujo de trabajo (obligatorio)

- **Ramas.** Una rama por cambio, chica e independiente, creada desde
  `dev` (`feat/…`, `fix/…`, `chore/…`, `docs/…`). Nunca se trabaja
  directo en `dev` ni en `main`.
- **Todo llega a `dev` por un Pull Request real de GitHub**
  (`gh pr create --base dev`). Prohibido `git merge` local + `git push`
  a `dev`. El agente **abre** el PR; **no lo mergea** salvo orden
  explícita del usuario.
- **`main` no se toca** salvo petición explícita del usuario.
- **Tamaño de commit.** Commits grandes y temáticos, no atómicos: cada
  commit agrupa **25–35 archivos** modificados. Si el cambio completo toca
  menos de 25, va en **un solo commit**; nunca se rellena con archivos
  ajenos para llegar al mínimo.
- **Commits** en formato Conventional Commits (`feat:`, `fix:`, `docs:`,
  `chore:`, `refactor:`, `perf:`, `test:`, `style:`, `ci:`, `build:`,
  `revert:`). El hook `commit-msg` lo valida. Ver `docs/DocsCommiter.md`.
- **Hooks de Husky (solo lo rápido).** `commit-msg` valida el formato y
  `pre-commit` pasa Biome sobre los archivos en staging. No uses
  `--no-verify`. Lint, tipos, tests y build los corre GitHub Actions en
  cada PR (`ci-dev.yml` hacia `dev`, `ci-main.yml` hacia `main`); un push
  no los ejecuta localmente: corre `pnpm check`, `pnpm test:unit` y
  `pnpm build` antes de abrir el PR.
- **Versiones.** Cada ronda mergeada se cierra con tag `vX.Y.Z`, GitHub
  Release y bump de `package.json`, en un PR aparte (`chore/release-vX.Y.Z`).
- **Verificación.** Un cambio de UI no está terminado hasta verlo
  funcionando (navegador, claro y oscuro, móvil y escritorio). Si algo no
  se pudo verificar, se dice en el PR; no se da por bueno.

## Seguridad

Este panel escribe en el backend con un token: es la pieza más sensible de
todo el sistema. **El repositorio es público.**

- **Nunca** pidas, escribas, leas ni imprimas contraseñas, tokens ni
  valores de `.env` (incluidos los secretos de Cloudflare y de GitHub
  Actions). No pruebes el token real del backend.
- No inventes sesiones, cookies ni tokens para "probar" nada. Para
  verificar sin credenciales reales, usa HTML estático o pruebas a nivel
  de código y deja dicho qué no se verificó. En desarrollo hay un usuario
  falso que existe **solo** bajo `import.meta.env.DEV`; nunca lo hagas
  alcanzable en un build de producción.
- **El navegador nunca habla con el backend.** Solo llama a las rutas
  `/api/*` de este mismo Worker (mismo origen). El backend se consume desde
  `src/server/backendClient.ts` (`fetch`, **sin axios**: un error de axios trae
  el token en `config.headers`), que agrega el bearer y reenvía el JWT de
  Access. Un `BackendError` lleva solo el estado HTTP, nunca el cuerpo ni las
  cabeceras. Misma regla en `src/lib/api.ts` del portafolio. `API_SECRET_TOKEN` solo se importa en `src/server/`; ningún
  componente, isla ni hook puede importar de `@/server/`.
- Toda ruta `/api/*` que cambie datos: verifica el usuario de Access, exige
  mismo origen, `application/json` y un tope de tamaño, y valida el cuerpo con
  Zod (esquemas en `src/schemas/`) **antes** de llamar al backend. Las
  respuestas de error son genéricas; nunca devuelvas ni registres el error
  crudo del backend ni las cabeceras de la petición.
- Las cabeceras de seguridad salen de `src/lib/securityHeaders.ts` y deben
  coincidir con `public/_headers` (lo comprueba un test). Todas las
  respuestas llevan `X-Robots-Tag: noindex` y las dinámicas
  `Cache-Control: private, no-store`.
- Subidas de archivos (R2): valida tipo y tamaño en el servidor, nunca confíes
  en la extensión ni en el `Content-Type` del cliente.
- `.gitignore` está endurecido (claves, volcados, respaldos, `.env*`): no lo
  aflojes para "subir un archivo rápido".

## Sistema de diseño (obligatorio para cualquier cambio de UI)

La fuente de verdad es **[`docs/UI_STANDARDS.md`](./docs/UI_STANDARDS.md)**
(copiado del portafolio). Léelo antes de tocar estilos o componentes.
**Aplican** las reglas 1–5 y 7–9 de abajo; **no aplican** las secciones del
documento sobre GSAP, hero, galaxia, manifiesto y escenas fijadas: el admin
no usa animaciones de scroll. Resumen de lo que no se negocia:

1. **Solo la paleta del proyecto.** Los colores salen de los tokens de
   `src/styles/app.css` (`bg-background`, `text-foreground`,
   `text-primary`, `border-border`, …), idénticos a los del portafolio.
   Prohibido hex, `rgb()` u `oklch()` sueltos en componentes, y **prohibido el
   blanco y el negro puros** (`#fff`, `#000`, `text-white`, `bg-black`).
   La base es **neutra** y el **violeta vive solo en `--primary`**. El test
   `tests/unit/designTokens.test.ts` lo hace cumplir. ¿Hace falta un color
   nuevo? Se agrega como token (claro y oscuro) con su contraste medido, y se
   copia también al portafolio para no divergir.
2. **Accesibilidad (WCAG 2.1 AA) por encima de la estética.** Contraste
   de texto ≥ 4.5:1 y de componentes/foco ≥ 3:1 en **ambos temas**; foco
   visible; todo operable con teclado; un solo `<h1>` y encabezados sin
   saltos; etiquetas visibles en formularios; errores asociados con
   `aria-describedby`; nada que dependa solo del color. Un CMS es todo
   formularios y tablas: prueba cada pantalla con teclado.
3. **shadcn estandarizado.** Usa los primitivos de `src/components/ui/`
   (`Button`, `Input`, `Card`, …) y las variantes existentes. No escribas
   botones, inputs ni cards a mano. Añade componentes (tabla, diálogo,
   alerta…) con la CLI de shadcn (`pnpm dlx shadcn@latest add <nombre>`), no
   copiándolos de memoria.
4. **Solo iconos de Lucide** (`lucide-react`). No agregues otra librería de
   iconos.
5. **Tipografía del sistema.** Instrument Serif para titulares
   (`font-serif-display`), Geist para texto, Geist Mono para etiquetas
   (`eyebrow`). Los tamaños salen de los tokens `text-display`, `text-title`,
   `text-subtitle` y `text-heading`; no uses `text-[clamp(...)]` ni
   `text-[Npx]`. No introduzcas otras fuentes ni `font-bold` en el serif.
   Una pantalla de datos puede usar texto más compacto que el cuerpo de 17 px,
   nunca por debajo de 14 px.
6. **Hovers táctiles, no cambios de color.** Cards: `hover-lift`;
   botones y chips: `hover-press`; flechas: `hover-nudge`. Un solo hover por
   elemento. En filas de tabla, un fondo `bg-muted` basta.
7. **Skeletons, nunca spinners.** Todo estado de carga usa `<Skeleton />`
   con la forma del contenido final; prohibido `animate-spin`, `Loader2` y
   `LoaderCircle`.
8. **Ley de Hick.** Un CTA primario por bloque; pocas opciones visibles;
   el detalle bajo demanda. Las acciones destructivas (borrar, publicar)
   piden confirmación y dicen exactamente qué pasará.
9. **Textos claros.** Español, voz activa, verbos concretos ("Guardar
   cambios", no "Enviar"); un mismo nombre para la misma acción en toda la
   interfaz (el botón "Publicar" produce un aviso "Publicado"). Los errores
   dicen qué falló y cómo arreglarlo, sin disculpas.

## Estructura

```
src/
├── components/    # compartidos; ui/ = primitivos shadcn
├── features/      # por dominio (inbox, comentarios, proyectos, experiencia, …)
├── hooks/         # hooks de React reutilizables (solo cliente)
├── layouts/       # Layout
├── lib/           # utilidades puras y seguras para el cliente (utils, media, securityHeaders)
├── middleware.ts  # cabeceras de seguridad y, luego, verificación de Access
├── pages/         # pantallas y rutas /api/* (mismo origen)
├── schemas/       # esquemas Zod compartidos entre cliente y servidor
├── server/        # SOLO servidor: cliente del backend, verificación de Access
├── styles/        # app.css (tokens + Tailwind v4)
└── types/         # tipos compartidos
tests/
├── unit/          # Vitest
└── e2e/           # Playwright
docs/              # ARQUITECTURA.md, UI_STANDARDS.md, DocsCommiter.md
```

## Documentación de Astro

Consulta estas guías antes de trabajar en lo relacionado:

- [Páginas, rutas dinámicas y middleware](https://docs.astro.build/en/guides/routing/)
- [Componentes de Astro](https://docs.astro.build/en/basics/astro-components/)
- [Componentes de React u otros frameworks](https://docs.astro.build/en/guides/framework-components/)
- [Estilos y Tailwind](https://docs.astro.build/en/guides/styling/)
- [Adaptador de Cloudflare](https://docs.astro.build/en/guides/integrations-guide/cloudflare/)

## Antes de entregar

- [ ] `pnpm check` en 0 errores y `pnpm check:biome` limpio.
- [ ] Tests nuevos o actualizados para lo que cambió; `pnpm test:unit` en verde.
- [ ] UI: probada en claro y oscuro, a 375 px y ≥ 1280 px, con teclado.
- [ ] Ninguna URL ni secreto escritos en el código; variables nuevas en
      `astro.config.mjs`, `.env.example` y la tabla de este archivo.
- [ ] PR hacia `dev`, con descripción de qué cambia y qué **no** se pudo
      verificar.
