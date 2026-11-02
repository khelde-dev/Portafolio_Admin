# Arquitectura del admin

Panel de administración (CMS) del portafolio. Este documento fija **cómo está
organizado y cómo se va a construir**, para que cada pantalla nueva siga el
mismo camino. Cuando algo cambie de verdad, se cambia aquí en el mismo PR.

> **Plan completo del CMS:** [`docs/plan/`](./plan/00-indice.md) (alcance, base de
> datos, backend, Zero Trust, imágenes en R2, validaciones, módulos, UI, pruebas,
> seguridad, roadmap y decisiones abiertas). Este documento resume la estructura
> del código; el plan dice **qué se construye y en qué orden**.

## Qué es y qué no es

- Es una app **Astro SSR + islas de React** en un Worker de Cloudflare que
  edita el contenido de `Backend_Portafolio` (proyectos, experiencia,
  educación, habilidades, sobre mí, comentarios, bandeja de contacto e
  imágenes en R2).
- **No tiene base de datos propia**, ni login, ni sesiones. Toda la verdad
  vive en el backend.
- **No es público**: nada de SEO, nada indexable, nada servido sin Cloudflare
  Access delante.

## Flujo de una petición

```
Navegador ──► Cloudflare Access ──► Worker "admin-portafolio" ──► Worker "backend-portafolio" ──► D1 / R2
 (tú)         login (correo +        1. middleware: cabeceras      verifica OTRA VEZ el JWT
              PIN / SSO). Pone       2. verifica el JWT de Access  de Access y el bearer
              el JWT en la           3. página SSR o ruta /api/*
              cabecera               4. src/server/backendClient
                                        agrega bearer + reenvía JWT
```

Tres puertas en serie, ninguna sustituye a la otra:

1. **Cloudflare Access** decide quién llega al Worker.
2. **El admin** verifica el JWT (`Cf-Access-Jwt-Assertion`, RS256, `aud` e
   `iss`) en el middleware. Si Access se desconfigura, el Worker no queda
   abierto: responde 401/503.
3. **El backend** vuelve a verificar el JWT y exige el bearer.

El navegador **solo** habla con rutas del mismo origen (`/api/...` de este
Worker). El backend y su token nunca se exponen a la red del usuario.

## Estructura de carpetas

```
src/
├── pages/          pantallas (.astro) y rutas /api/* (.ts)
│   ├── index.astro
│   └── api/        un archivo por recurso: proyectos.ts, comentarios.ts, …
├── features/       una carpeta por dominio; aquí vive la UI real
│   └── <dominio>/
│       ├── <Dominio>Page.tsx    isla principal (lista + acciones)
│       ├── <Dominio>Form.tsx    formulario (react-hook-form + Zod)
│       ├── api.ts               fetch a /api/<dominio> (mismo origen)
│       └── types.ts
├── components/     piezas compartidas entre dominios; ui/ = shadcn
├── hooks/          hooks reutilizables (solo cliente)
├── schemas/        esquemas Zod: UNA definición, usada en cliente y servidor
├── server/         SOLO servidor (nunca se importa desde el navegador)
│   ├── backendClient.ts   único punto de contacto con el backend
│   └── access.ts          verificación del JWT de Access (pendiente)
├── lib/            utilidades puras: utils (cn), media, securityHeaders
├── layouts/        Layout.astro (html, tema, noindex)
├── styles/         app.css: tokens + Tailwind v4
└── middleware.ts   cabeceras de seguridad + identidad del usuario
tests/
├── unit/           Vitest: lógica (server/, lib/, schemas/, hooks/, features/*.ts)
└── e2e/            Playwright: pantallas reales
```

Reglas que hace cumplir `tests/unit/hygiene.test.ts`:

- `API_SECRET_TOKEN` solo aparece en `src/server/`.
- `components/`, `features/` y `hooks/` no importan de `@/server/`.
- No hay URLs de infraestructura escritas fuera de la configuración.
- No hay formularios de contraseña ni rutas de login.

## Patrón de una feature

Tomando "bandeja de contacto" como ejemplo, el camino siempre es el mismo:

1. **Esquema** en `src/schemas/inbox.ts` (Zod): la forma de un mensaje y la de
   los cambios permitidos (por ejemplo, marcar como leído).
2. **Ruta de servidor** `src/pages/api/inbox.ts`: toma el usuario de
   `Astro.locals`, comprueba mismo origen y `application/json`, valida con el
   esquema, llama a `callBackend()` con el JWT de la petición y devuelve un
   JSON limpio. Los errores del backend se traducen a `{ message }` genérico.
3. **Cliente** `src/features/inbox/api.ts`: `fetch("/api/inbox")`, tipado con el
   mismo esquema. Nada de URLs absolutas.
4. **Isla** `InboxPage.tsx`: lista con `Skeleton` mientras carga, estados vacío
   y de error con una acción clara, confirmación en lo destructivo.
5. **Pantalla** `src/pages/inbox.astro`: monta la isla con `client:load` dentro
   de `Layout`.
6. **Pruebas**: unitaria del esquema y de la ruta; e2e del flujo principal con
   `axe`.

## Variables y URLs

Todo lo que cambia entre entornos es una variable y se declara **una sola vez**
en `env.schema` de `astro.config.mjs`. Hay dos tipos:

| Tipo | Se lee con | Cuándo se fija | Dónde se cambia |
|---|---|---|---|
| Servidor | `astro:env/server` | en runtime | `vars` de `wrangler.jsonc` / panel; el secreto con `wrangler secret put` |
| Cliente | `astro:env/client` | al compilar | variables de **build** del panel de Cloudflare |

Al comprar `khelde.dev` se cambian solo `BACKEND_URL`, `PUBLIC_MEDIA_URL` y
`PUBLIC_PORTFOLIO_URL`. Si Access se mueve a un hostname nuevo dentro de la
misma aplicación, `ACCESS_AUD` no cambia.

## Identidad y Cloudflare Access

- Access protege la URL `workers.dev` del Worker (Worker → Settings → Domains &
  Routes → Cloudflare Access) y, cuando exista, el dominio propio.
- `preview_urls` está desactivado para que no existan URLs sin proteger.
- **No** actives Access en el Worker del **backend**: bloquearía al portafolio
  público, que lo consume sin sesión.
- En `pnpm dev` no hay Access: el middleware inyecta un usuario falso solo
  cuando `import.meta.env.DEV` es verdadero. Ese código se elimina del build de
  producción y una prueba lo comprueba.
- Orden de puesta en marcha: crear la aplicación de Access → copiar su AUD y el
  dominio del equipo a `ACCESS_AUD` / `ACCESS_TEAM_DOMAIN` (en este Worker y en
  el backend) → cargar `API_SECRET_TOKEN` → recién entonces desplegar con datos
  reales.

## Pruebas y calidad

| Capa | Herramienta | Qué cubre |
|---|---|---|
| Lógica | Vitest + cobertura v8 | `server/`, `lib/`, `schemas/`, `hooks/` (pisos en `vitest.config.ts`) |
| Higiene | Vitest | secretos, URLs fijas, login, XSS, workflows |
| Tokens de diseño | Vitest | contraste WCAG y paleta (`designTokens.test.ts`) |
| Pantallas | Playwright + axe | flujos reales, cabeceras, accesibilidad |
| Seguridad continua | CodeQL, gitleaks, dependency review, `pnpm audit` | `security.yml`, `ci-main.yml` |

Los `.astro` y los primitivos de `components/ui` quedan fuera de la cobertura de
líneas: los cubre Playwright.

## Hoja de ruta (v1)

1. **Esqueleto** (este PR): tooling, tokens, cabeceras, cliente del backend.
2. **Identidad:** `server/access.ts` (verificación del JWT) + usuario falso en
   desarrollo + 401/503 en producción sin Access.
3. **Bandeja de contacto y moderación de comentarios** (lo que más se usa).
4. **CRUD de proyectos, experiencia, educación, habilidades y sobre mí.**
5. **Imágenes:** subida y borrado en R2. Requiere endpoints nuevos en el
   backend (hoy no existen); se diseñan allá primero.

## Decisiones abiertas

- **Service Binding al backend** en lugar de su URL pública: el tráfico no sale
  a internet y el backend puede cerrar el acceso público para el CMS. Se activa
  descomentando `services` en `wrangler.jsonc` y cambiando `backendClient` para
  usar el binding; los tests no cambian.
- **Dominio propio:** `admin.khelde.dev` como hostname extra de la misma app de
  Access.
- **CSP completo** (`script-src` / `style-src`): se activa después de
  verificarlo en un navegador, igual que en el portafolio.
