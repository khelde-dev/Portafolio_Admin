import { defineMiddleware } from "astro:middleware";
import { withSecurityHeaders } from "@/lib/securityHeaders";

// Punto unico de entrada de cada peticion. Hoy solo pone las cabeceras de
// seguridad; aqui se enchufara la verificacion del JWT de Cloudflare Access
// (src/server/access.ts) y el `locals.user` que usan las paginas y /api/*.
export const onRequest = defineMiddleware(async (_ctx, next) =>
	withSecurityHeaders(await next()),
);
