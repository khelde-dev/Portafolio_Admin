import type { APIRoute } from "astro";

// El admin es privado: ningun buscador debe rastrearlo (ademas de la
// cabecera X-Robots-Tag de todas las respuestas).
export const GET: APIRoute = () =>
	new Response("User-agent: *\nDisallow: /\n", {
		headers: { "Content-Type": "text/plain; charset=utf-8" },
	});
