import { API_SECRET_TOKEN, BACKEND_URL } from "astro:env/server";

/**
 * Unico cliente del Backend_Portafolio. Solo corre en el servidor (Worker):
 * el navegador habla con las rutas /api/* del propio admin, nunca con el
 * backend, asi el token no sale de aqui.
 *
 * - Agrega el bearer y reenvia el JWT de Cloudflare Access (el backend lo
 *   vuelve a verificar: dos puertas, no una).
 * - La URL base sale de BACKEND_URL; nada de URLs escritas en el codigo.
 * - Los errores NO llevan cuerpo ni cabeceras del backend (podrian traer
 *   datos o el token): solo el estado HTTP.
 */
export class BackendError extends Error {
	constructor(readonly status: number) {
		super(`El backend respondio ${status}`);
		this.name = "BackendError";
	}
}

export interface BackendRequest {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	body?: unknown;
	/** JWT de Cloudflare Access de la peticion en curso. */
	accessJwt?: string | null;
	timeoutMs?: number;
}

const TIMEOUT_MS = 10_000;

/** `/projects/3` -> `<BACKEND_URL>/projects/3`. Rechaza rutas que escapen de la base. */
export const buildBackendUrl = (path: string, base = BACKEND_URL): string => {
	if (!path.startsWith("/") || path.startsWith("//")) {
		throw new Error("La ruta del backend debe empezar con una sola /");
	}
	// Solo la ruta: un `..` dentro de un valor de la consulta no es un segmento.
	if (
		path
			.split("?")[0]
			.split("/")
			.some((segment) => segment === "..")
	) {
		throw new Error("La ruta del backend no puede contener ..");
	}
	return `${base.replace(/\/+$/, "")}${path}`;
};

export const callBackend = async <T = unknown>(
	path: string,
	{
		method = "GET",
		body,
		accessJwt,
		timeoutMs = TIMEOUT_MS,
	}: BackendRequest = {},
): Promise<T> => {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${API_SECRET_TOKEN}`,
		Accept: "application/json",
	};
	if (accessJwt) headers["Cf-Access-Jwt-Assertion"] = accessJwt;
	if (body !== undefined) headers["Content-Type"] = "application/json";

	const response = await fetch(buildBackendUrl(path), {
		method,
		headers,
		body: body === undefined ? undefined : JSON.stringify(body),
		signal: AbortSignal.timeout(timeoutMs),
	});
	if (!response.ok) throw new BackendError(response.status);
	return (await response.json()) as T;
};
