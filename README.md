# Portafolio Admin

Panel de administración (CMS) del [portafolio de Erick González](https://github.com/muke78/Portafolio).
Edita el contenido que sirve [`Backend_Portafolio`](https://github.com/muke78/Backend_Portafolio)
(Worker de Hono + D1 + R2).

**Sin pantalla de login:** la identidad la resuelve **Cloudflare Access** delante
del Worker; el admin verifica el JWT que Access le manda. El token del backend
vive solo en el servidor y el navegador nunca habla con el backend.

> Estado: esqueleto. Tooling, tokens de diseño, cabeceras de seguridad y cliente
> del backend listos; las pantallas se construyen siguiendo
> [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md).

## Stack

- [Astro 7](https://astro.build) SSR + islas de React 18 en **Cloudflare Workers**
- Tailwind CSS v4 + shadcn/ui sobre Base UI (misma paleta que el portafolio)
- Zod + react-hook-form · Biome · Vitest (cobertura v8) · Playwright + axe
- Husky (commit-msg + Biome en staging) · GitHub Actions (CI, CodeQL, gitleaks)

## Empezar

Requisitos: Node ≥ 22.12 y **pnpm** (la versión exacta sale de `packageManager`).

```bash
pnpm install
cp .env.example .env     # completa API_SECRET_TOKEN; el resto tiene valores por defecto
pnpm dev                 # http://localhost:4322
```

En desarrollo no hay Cloudflare Access: el admin usa un usuario falso que solo
existe bajo `import.meta.env.DEV`.

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | servidor de desarrollo (puerto 4322) |
| `pnpm build` | build de producción |
| `pnpm check` | tipos (`astro check`), debe quedar en 0 errores |
| `pnpm check:biome` | Biome: formato + lint con `--write` |
| `pnpm lint:ci` | Biome en modo CI (sin escribir) |
| `pnpm test:unit` | Vitest |
| `pnpm test:unit:coverage` | Vitest con cobertura y pisos mínimos |
| `pnpm test:e2e` | Playwright (levanta el servidor si hace falta) |

## Variables

Todas las URLs son variables; se declaran una sola vez en `astro.config.mjs` y
se documentan en [`.env.example`](./.env.example).

| Variable | Contexto | Secreta | Para qué |
|---|---|---|---|
| `BACKEND_URL` | servidor | no | base de la API de contenido |
| `API_SECRET_TOKEN` | servidor | **sí** | bearer hacia el backend |
| `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` | servidor | no | verificar el JWT de Access |
| `PUBLIC_MEDIA_URL` | cliente (build) | no | origen público de R2 |
| `PUBLIC_PORTFOLIO_URL` | cliente (build) | no | enlaces al portafolio público |

## Despliegue

Cloudflare Workers Builds, rama de producción `main`:

- Build: `pnpm build` · Deploy: `npx wrangler deploy`
- Secreto: `npx wrangler secret put API_SECRET_TOKEN` (o en el panel)
- Variables de **build** (`PUBLIC_*`): panel del Worker → Settings → Build →
  Variables

**No despliegues con datos reales sin Cloudflare Access activo** sobre el Worker.
Pasos y orden en [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md#identidad-y-cloudflare-access).

## Flujo de trabajo

Ramas desde `dev` (`feat/…`, `fix/…`, `chore/…`), Pull Request a `dev`, `main`
solo para releases. Commits en
[Conventional Commits](./docs/DocsCommiter.md). Las reglas completas, de
seguridad y de diseño, están en [`AGENTS.md`](./AGENTS.md).

## Documentación

- [`docs/ARQUITECTURA.md`](./docs/ARQUITECTURA.md): estructura, flujo y hoja de ruta
- [`docs/UI_STANDARDS.md`](./docs/UI_STANDARDS.md): sistema de diseño
- [`docs/DocsCommiter.md`](./docs/DocsCommiter.md): prefijos de commit

## Licencia

[MIT](./LICENSE)
