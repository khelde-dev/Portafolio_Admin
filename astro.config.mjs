import cloudflare from "@astrojs/cloudflare";
import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, envField } from "astro/config";

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
				default:
					"https://backend-portafolio.erickm-gonzalez-rivera.workers.dev/api",
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

			// --- Cliente (se incrustan al compilar: son variables de BUILD). ----
			// Origen publico del bucket R2 (imagenes). Ver src/lib/media.ts.
			PUBLIC_MEDIA_URL: envField.string({
				context: "client",
				access: "public",
				default: "https://pub-a3fda08feb4f417fa5634c34e7959461.r2.dev",
			}),
			// El portafolio publico (enlaces "ver sitio" / "ver proyecto").
			PUBLIC_PORTFOLIO_URL: envField.string({
				context: "client",
				access: "public",
				default: "https://portafolio.erickm-gonzalez-rivera.workers.dev",
			}),
		},
	},

	// Sin sesiones: la identidad la da Cloudflare Access en cada peticion. Sin
	// esto el adaptador agrega un KV `SESSION` que nadie usa.
	session: false,
	output: "server",
	// Vitest carga esta config con getViteConfig(); el plugin del adaptador
	// levantaria un workerd por cada corrida de pruebas.
	adapter: process.env.VITEST ? undefined : cloudflare(),
});
