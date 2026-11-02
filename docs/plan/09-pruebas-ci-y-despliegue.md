# 09 · Pruebas, CI y despliegue

## Estrategia de pruebas

| Capa | Herramienta | Qué cubre | Dónde corre |
|---|---|---|---|
| Unitarias | Vitest | esquemas Zod, `translations`, conversión de imagen, `backendClient`, `access.ts`, helpers | local, CI |
| Higiene | Vitest | secretos, URLs fijas, login, XSS, workflows, que el token solo viva en `src/server/` | local, CI |
| Tokens de diseño | Vitest | contraste WCAG y paleta (`designTokens.test.ts`) | local, CI |
| Rutas `/api/*` | Vitest con `fetch` simulado | lista blanca, mismo origen, validación, traducción de errores | local, CI |
| Componentes | Vitest + Testing Library (jsdom) | `ResourceForm`, `LocaleTabs`, `ImagePicker` | local, CI |
| E2E | Playwright + axe | flujos reales contra un **backend simulado** | CI en `main` |
| Contrato | fixtures compartidas | el admin y el backend aceptan y rechazan lo mismo | ambos repos |

### Reglas

- **Cobertura mínima** (pisos en `vitest.config.ts`): líneas/sentencias 90 %,
  funciones 88 %, ramas 80 %. Un PR que los baje falla.
- **Cada ruta nueva de `/api/*` trae sus pruebas de rechazo**: método no permitido,
  sin JWT, otro origen, cuerpo inválido, cuerpo gigante, error del backend.
- **Cada pantalla nueva pasa `axe`** sin violaciones (WCAG 2.1 AA).
- **Nunca se usa el token real ni un JWT real en pruebas.** Para firmar JWT de
  prueba se genera un par RSA en el propio test (como hace
  `tests/support/forge.ts` del backend) y se inyecta como `ACCESS_JWKS`.

### E2E sin un backend de verdad

Las rutas del admin llaman al backend **desde el Worker**, así que
`page.route()` del navegador no las intercepta. Solución: un **backend simulado**
(servidor HTTP mínimo de Node en `tests/e2e/mock-backend.ts`, puerto 8788) que
Playwright levanta junto con el admin; el admin arranca con
`BACKEND_URL=http://localhost:8788/api`. El simulado responde con datos de
`tests/contracts/` y registra lo que recibe para que la prueba lo compruebe
("al guardar, el backend recibió este cuerpo"). Cero credenciales, cero dependencia
de la red.

### Contrato con el backend

- `tests/contracts/<recurso>.valid.json` / `.invalid.json`, copiados también al
  backend (`tests/contracts/`). Cada repo prueba **sus** esquemas contra los mismos
  archivos; si uno cambia, falla en el repo que no se actualizó.
- Antes de cada release del admin se corre una **comprobación contra el backend
  desplegado** (`GET /api` para la versión) y se anota en el PR.

## CI/CD

Ya existe (v0.1.0) y se hereda del portafolio:

| Workflow | Cuándo | Qué hace |
|---|---|---|
| `ci-dev.yml` | PR a `dev` | Biome, `astro check`, Vitest con cobertura, build, escáner de secretos del bundle |
| `ci-main.yml` | PR a `main` | lo anterior + Playwright + auditoría estricta |
| `security.yml` | PR, `main` y lunes | CodeQL, gitleaks, dependency review, `pnpm audit` |
| Dependabot | lunes | un PR agrupado de dependencias y otro de acciones |

Cambios previstos: el job `e2e` ya corre siempre en `main`; cuando el backend
simulado exista no necesita variables de repositorio.

El **escáner de secretos del bundle** (`scripts/check-bundle-secrets.mjs`) busca
`API_SECRET_TOKEN` en `dist/client`: el token no puede estar en nada que descargue
el navegador.

## Variables y secretos

| Variable | Tipo | Dónde se define | Notas |
|---|---|---|---|
| `BACKEND_URL` | runtime, no secreta | `wrangler.jsonc` → `vars` | con Service Binding deja de usarse |
| `ACCESS_TEAM_DOMAIN` | runtime, no secreta | `wrangler.jsonc` → `vars` | con `https://`, igual que en el backend |
| `ACCESS_AUD` | runtime, no secreta | `wrangler.jsonc` → `vars` | igual que en el backend |
| `ADMIN_EMAILS` | runtime, no secreta | `wrangler.jsonc` → `vars` | correos permitidos, separados por coma (**nuevo, fase 1**) |
| `API_SECRET_TOKEN` | runtime, **secreta** | `wrangler secret put` o el panel | mismo valor que `API_TOKEN` del backend |
| `PUBLIC_MEDIA_URL` | **build** | panel de Cloudflare → variables de build | se incrusta al compilar |
| `PUBLIC_PORTFOLIO_URL` | **build** | panel de Cloudflare → variables de build | se incrusta al compilar |

Reglas:

1. **Ningún secreto en el repo**, ni en `wrangler.jsonc`, ni en `.env.example`, ni
   en el chat, ni en un `console.log`. Lo hace cumplir la prueba de higiene y
   gitleaks.
2. Las variables de **build** (`PUBLIC_*`) no se leen en runtime: cambiarlas exige
   un nuevo deploy.
3. Un valor que se repite en dos Workers (`ACCESS_AUD`, `ACCESS_TEAM_DOMAIN`,
   `API_SECRET_TOKEN`) se cambia **en los dos a la vez**.
4. Rotar el token: `wrangler secret put` en el backend y en el admin (y en el
   portafolio), comprobar y listo; sin tiempo de inactividad si se hace seguido.

## Despliegue

- **Cloudflare Workers Builds** con la integración Git del repo. Producción:
  rama `main`. Comando de compilación `pnpm build`, de despliegue
  `npx wrangler deploy`.
- Las variables de build del panel de Cloudflare se escriben **sin comillas** y se
  comprueba que existan (en el portafolio una variable de build no llegó y por eso
  `astro.config.mjs` trae valores por defecto para las URLs públicas; el admin hace
  igual).
- Los **builds de ramas no productivas** hacen `wrangler versions upload`/`preview`;
  en el backend fallan sin un bloque `previews`. Para el admin, que **no debe tener
  URLs de vista previa**, lo más sencillo es **desactivar los builds de ramas no
  productivas** en el panel (Settings → Build). La verificación de una rama la hace
  el CI de GitHub, no Cloudflare.
- **Rollback:** Workers → Deployments → restaurar la versión anterior (un clic).
  Un cambio de esquema en el backend es aditivo, así que un admin anterior sigue
  funcionando con un backend nuevo.
- Antes de una release: `pnpm check`, `pnpm test:unit:coverage`, `pnpm build` y, si
  tocó algo visual, una pasada manual en claro/oscuro y 375/1280 px.

## Costos

El objetivo es **cero costos sorpresa**. La arquitectura **no usa**: cron
triggers, colas, Durable Objects, Workflows, KV, Images, Stream ni correo
saliente. Cada uno es una puerta a un cobro por uso que no se necesita.

| Servicio | Uso esperado | Plan gratuito (a verificar en el panel al construir) |
|---|---|---|
| Workers (admin + backend + portafolio) | cientos de peticiones/día del admin; el sitio público es la mayor parte | 100 000 peticiones/día |
| D1 | lecturas diminutas, decenas de escrituras/mes | millones de filas leídas/día, 5 GB |
| R2 | decenas de MB de imágenes | 10 GB-mes, 1 M operaciones de escritura y 10 M de lectura/mes |
| Access (Zero Trust) | 1 usuario | gratuito hasta 50 usuarios |
| Dominio `khelde.dev` | opcional | ~8 USD el primer año, ~12 después (lo único con costo real) |

Precauciones concretas:

- Ninguna ruta del CMS hace trabajo en bucle sobre R2 (`list()` se pagina y solo la
  pide la pantalla de Medios, bajo demanda).
- Las imágenes se sirven con `immutable` y caché larga: casi todas las lecturas las
  absorbe la caché, no R2.
- Si algún día se activa algo con cobro por uso, se anota aquí **antes** de
  construirlo y se le pone un tope.

## Observabilidad y operación

- **Workers Logs** ya está activo (`observability.enabled`). Los mensajes de error
  son genéricos; el detalle útil (estado HTTP, ruta, recurso) sí se registra, el
  cuerpo de las peticiones **nunca**.
- La pantalla **Estado** del admin es el primer lugar donde mirar.
- Auditoría de cambios: `audit_log` (fase 7) además del log de consola.
- **Alertas:** no hay; un panel de un solo usuario no las justifica. Si una subida
  o un guardado falla, la persona lo ve en pantalla en el momento.

## Mantenimiento

- **Dependabot** semanal; las alertas de seguridad se atienden en la semana.
- Revisión trimestral: `pnpm audit`, versiones de Astro/Base UI/shadcn y que la
  paleta del admin coincida con la del portafolio (`app.css`).
- Cuando se actualice un componente de shadcn, hacerlo con la CLI y revisar el
  diff; no editar a mano los primitivos de `components/ui`.
