import { ACCESS_AUD, ACCESS_TEAM_DOMAIN, ADMIN_EMAILS } from "astro:env/server";
import { defineMiddleware } from "astro:middleware";
import { withSecurityHeaders } from "@/lib/securityHeaders";
import { authenticate, parseAllowedEmails } from "@/server/access";

const MESSAGES = {
	401: "Necesitas iniciar sesión con Cloudflare Access.",
	403: "Esta cuenta no tiene permiso para entrar.",
	503: "Cloudflare Access no está configurado en este servidor.",
} as const;

const denied = (status: 401 | 403 | 503, isApi: boolean): Response => {
	const message = MESSAGES[status];
	if (isApi) return Response.json({ message }, { status });
	// Sin plantilla ni datos: nada del panel se sirve sin identidad.
	return new Response(
		`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Acceso denegado</title><body><p>${message}</p></body></html>`,
		{ status, headers: { "Content-Type": "text/html; charset=utf-8" } },
	);
};

/**
 * Puerta de entrada de TODA peticion que llega al Worker (los archivos
 * estaticos los sirve Cloudflare antes, y viven detras de la misma aplicacion
 * de Access). Primero identidad, despues cabeceras de seguridad.
 */
export const onRequest = defineMiddleware(async (ctx, next) => {
	const isApi = ctx.url.pathname.startsWith("/api/");

	const result = await authenticate(
		ctx.request.headers,
		{
			team: ACCESS_TEAM_DOMAIN,
			aud: ACCESS_AUD,
			allowedEmails: parseAllowedEmails(ADMIN_EMAILS),
		},
		{ dev: import.meta.env.DEV },
	);
	if (result.ok === false) {
		return withSecurityHeaders(denied(result.status, isApi));
	}

	ctx.locals.user = result.user;
	return withSecurityHeaders(await next());
});
