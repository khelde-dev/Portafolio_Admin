/**
 * Guardias de las rutas /api/* del admin. El navegador tiene la cookie de Access,
 * asi que una pagina ajena podria intentar usarla (CSRF): cada comprobacion
 * corta un vector distinto antes de gastar una llamada al backend.
 */

/** Tope del cuerpo JSON: el formulario mas grande (3 idiomas de un proyecto) pesa unos KB. */
export const MAX_BODY_BYTES = 64 * 1024;

type Guard<T> =
	| { ok: true; value: T }
	| { ok: false; status: number; message: string };

/**
 * Rechaza peticiones que vienen de otro sitio. Un navegador siempre manda
 * `Origin` en una escritura; `Sec-Fetch-Site` cubre clientes que no lo mandan.
 * Sin ninguna de las dos (curl, pruebas) no hay contexto de navegador del que
 * protegerse: la identidad de Access y la validacion siguen aplicando.
 */
export const isSameOrigin = (request: Request, siteOrigin: string): boolean => {
	const origin = request.headers.get("origin");
	if (origin !== null) return origin === siteOrigin;
	const fetchSite = request.headers.get("sec-fetch-site");
	return (
		fetchSite === null || fetchSite === "same-origin" || fetchSite === "none"
	);
};

export const isJsonContentType = (request: Request): boolean =>
	/^application\/json(\s*;|$)/i.test(request.headers.get("content-type") ?? "");

/**
 * Lee el cuerpo como JSON con tope de tamano. Exige `Content-Type:
 * application/json`: un formulario HTML ajeno solo puede mandar `text/plain` o
 * `x-www-form-urlencoded` sin pasar por CORS, asi que esto tambien cierra el CSRF.
 */
export const readJsonBody = async (
	request: Request,
	maxBytes = MAX_BODY_BYTES,
): Promise<Guard<unknown>> => {
	if (!isJsonContentType(request)) {
		return {
			ok: false,
			status: 415,
			message: "El contenido debe ser application/json",
		};
	}

	const declared = Number(request.headers.get("content-length") ?? 0);
	if (Number.isFinite(declared) && declared > maxBytes) {
		return { ok: false, status: 413, message: "El cuerpo es demasiado grande" };
	}

	let text: string;
	try {
		text = await request.text();
	} catch {
		return { ok: false, status: 400, message: "Cuerpo no válido" };
	}
	// `content-length` se puede omitir o mentir: se vuelve a medir el texto real.
	if (new TextEncoder().encode(text).length > maxBytes) {
		return { ok: false, status: 413, message: "El cuerpo es demasiado grande" };
	}

	try {
		return { ok: true, value: JSON.parse(text) };
	} catch {
		return { ok: false, status: 400, message: "JSON no válido" };
	}
};
