/**
 * Cabeceras de seguridad que el admin manda en TODAS sus respuestas.
 *
 * Las respuestas dinamicas (paginas SSR y /api/*) las recibe del middleware;
 * los archivos estaticos (JS/CSS/fuentes del build) las reciben de
 * `public/_headers`. tests/unit/securityHeaders.test.ts compara ambas listas
 * para que no se separen.
 *
 * Mismas cabeceras que el portafolio mas `X-Robots-Tag`: el admin nunca debe
 * indexarse. El CSP es parcial a proposito (marcos, `<base>`, plugins,
 * formularios); un `script-src` / `style-src` real se activa despues de
 * verificarlo en un navegador.
 */
export const SECURITY_HEADERS = {
	"Strict-Transport-Security": "max-age=31536000; includeSubDomains",
	"X-Content-Type-Options": "nosniff",
	"X-Frame-Options": "DENY",
	"Referrer-Policy": "strict-origin-when-cross-origin",
	"Permissions-Policy":
		"camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
	"Cross-Origin-Opener-Policy": "same-origin",
	"Content-Security-Policy":
		"base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
	"X-Robots-Tag": "noindex, nofollow",
} as const;

/**
 * Solo para respuestas dinamicas: contienen datos privados y ningun proxy ni
 * cache compartido debe guardarlas. No va en `_headers`: los archivos con hash
 * del build si deben cachearse.
 */
export const DYNAMIC_HEADERS = {
	"Cache-Control": "private, no-store",
} as const;

/**
 * Devuelve la respuesta con las cabeceras puestas. Una cabecera que la ruta ya
 * definio se respeta. Si las cabeceras de la respuesta son inmutables (las de
 * un `fetch` lo son), se copia la respuesta en lugar de fallar.
 */
export const withSecurityHeaders = (response: Response): Response => {
	const apply = (target: Response) => {
		for (const [name, value] of Object.entries({
			...SECURITY_HEADERS,
			...DYNAMIC_HEADERS,
		})) {
			if (!target.headers.has(name)) target.headers.set(name, value);
		}
		return target;
	};
	try {
		return apply(response);
	} catch {
		return apply(
			new Response(response.body, {
				status: response.status,
				statusText: response.statusText,
				headers: response.headers,
			}),
		);
	}
};
