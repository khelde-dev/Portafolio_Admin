import { createHash } from "node:crypto";
import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";
import { THEME_SCRIPT } from "./src/lib/inlineScripts.ts";

// Origenes de imagenes que el CSP permite en `img-src`. Mismas variables y mismos
// valores por defecto que `PUBLIC_MEDIA_URL` / `PUBLIC_ICONS_URL` del esquema de abajo.
const MEDIA_ORIGIN = new URL(
	process.env.PUBLIC_MEDIA_URL ?? "https://media.khelde.dev",
).origin;
const ICONS_ORIGIN = new URL(
	process.env.PUBLIC_ICONS_URL ?? "https://go-skill-icons.vercel.app/api/icons",
).origin;

// sha256 del <script is:inline> del Layout (Astro no hashea los `is:inline`).
const hashOf = (source) =>
	`sha256-${createHash("sha256").update(source).digest("base64")}`;

// Todas las URLs del admin son variables (nunca texto fijo en componentes).
// Cada una vive en UN solo lugar: aqui se declara, con valor por defecto cuando
// es una URL publica, y .env.example / wrangler.jsonc dicen donde se cambia.
//
// Al comprar el dominio (khelde.dev) solo cambian estos valores:
//   BACKEND_URL           https://api.khelde.dev/api
//   PUBLIC_MEDIA_URL      https://media.khelde.dev
//   PUBLIC_PORTFOLIO_URL  https://khelde.dev
export default defineConfig({
	integrations: [react()],

	compressHTML: true,
	// El CSS (~18 kB) va en linea: un <link> bloquearia el primer render.
	build: { inlineStylesheets: "always" },

	devToolbar: { enabled: false },

	// CSP con hashes: Astro calcula el hash de cada <script> y <style> que genera y lo
	// pone en un <meta http-equiv="content-security-policy"> por pagina. Solo funciona
	// en `build` + `preview`, no en `dev`. Las directivas que no pueden ir en un <meta>
	// (frame-ancestors...) siguen en src/lib/securityHeaders.ts y public/_headers.
	security: {
		csp: {
			directives: [
				"default-src 'self'",
				// R2 (imagenes), go-skill-icons (tecnologias) y blob: (vista previa de una
				// imagen antes de subirla).
				`img-src 'self' data: blob: ${MEDIA_ORIGIN} ${ICONS_ORIGIN}`,
				"font-src 'self' data:",
				// El navegador solo habla con el propio admin: el backend se alcanza desde
				// el servidor (/api/* del Worker).
				"connect-src 'self'",
				"worker-src 'self' blob:",
				"media-src 'self'",
				"manifest-src 'self'",
				"frame-src 'none'",
				"base-uri 'self'",
				"object-src 'none'",
				"frame-ancestors 'none'",
				"form-action 'self'",
			],
			scriptDirective: { hashes: [hashOf(THEME_SCRIPT)] },
			// Los atributos style="" (Astro y React los ponen) no se pueden hashear; no
			// ejecutan codigo, asi que solo ellos quedan en `unsafe-inline`. Las
			// etiquetas <style> y <script> siguen exigiendo hash.
			styleDirective: {
				resources: [
					"'self'",
					{ resource: "'unsafe-inline'", kind: "attribute" },
				],
			},
		},
	},

	// 4322, no 4321: el portafolio y el admin pueden correr a la vez.
	server: { port: 4322 },

	vite: {
		plugins: [tailwindcss()],
	},

	env: {
		schema: {
			// --- Servidor (Worker). Nunca llegan al navegador. -------------------
			// API de contenido que el admin edita. Con dominio propio: la del Worker
			// `Backend_Portafolio` ya no seria workers.dev. Idealmente se reemplaza
			// por un Service Binding (ver docs/ARQUITECTURA.md).
			BACKEND_URL: envField.string({
				context: "server",
				access: "public",
				default: "https://api.khelde.dev/api",
			}),
			// Secreto: el mismo bearer que el backend espera en API_TOKEN.
			API_SECRET_TOKEN: envField.string({
				context: "server",
				access: "secret",
			}),
			// Cloudflare Access: el Worker verifica el JWT `Cf-Access-Jwt-Assertion`
			// contra estos dos valores. Vacios en dev (hay un usuario falso solo con
			// `import.meta.env.DEV`); en produccion un admin sin ellos responde 503.
			ACCESS_TEAM_DOMAIN: envField.string({
				context: "server",
				access: "public",
				default: "",
			}),
			ACCESS_AUD: envField.string({
				context: "server",
				access: "public",
				default: "",
			}),
			// SOLO desarrollo: llave PRIVADA de prueba (JWK en JSON) con la que el admin
			// firma un JWT de Access falso para hablar con el backend local. La genera
			// `pnpm dev:access`. En produccion no existe y no se lee.
			DEV_ACCESS_KEY: envField.string({
				context: "server",
				access: "secret",
				optional: true,
			}),
			// Secreto opcional: correos permitidos (separados por coma). Defensa en
			// profundidad por si la politica de Access se relaja. Va como secreto y
			// no en wrangler.jsonc porque el repositorio es publico.
			ADMIN_EMAILS: envField.string({
				context: "server",
				access: "secret",
				optional: true,
			}),

			// --- Cliente (se incrustan al compilar: son variables de BUILD). ----
			// Origen publico del bucket R2 (imagenes). Ver src/lib/media.ts.
			PUBLIC_MEDIA_URL: envField.string({
				context: "client",
				access: "public",
				default: "https://media.khelde.dev",
			}),
			// Servicio que dibuja los iconos de las tecnologias (`?i=<nombre>`): el
			// mismo que usa el portafolio. Cuando se autoalojen, solo cambia esto.
			PUBLIC_ICONS_URL: envField.string({
				context: "client",
				access: "public",
				default: "https://go-skill-icons.vercel.app/api/icons",
			}),
			// El portafolio publico (enlaces "ver sitio" / "ver proyecto").
			PUBLIC_PORTFOLIO_URL: envField.string({
				context: "client",
				access: "public",
				default: "https://khelde.dev",
			}),
		},
	},

	// Sin sesiones: la identidad la da Cloudflare Access en cada peticion. Sin
	// esto el adaptador agrega un KV `SESSION` que nadie usa.
	session: false,
	output: "server",
	// Vitest carga esta config con getViteConfig(); el plugin del adaptador
	// levantaria un workerd por cada corrida de pruebas.
	// `passthrough`: el admin no usa <Image>; sin esto el adaptador agrega un
	// binding IMAGES (Cloudflare Images) que tiene cuota gratuita y luego cobro.
	adapter: process.env.VITEST
		? undefined
		: cloudflare({ imageService: "passthrough" }),
});
