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
 *   datos o el token): solo el estado HTTP y, en un 400 de validacion, los
 *   avisos por campo ya depurados (`issues`).
 */
export interface FieldIssue {
	path: (string | number)[];
	message: string;
}

/** Donde se usa una imagen (la respuesta 409 de DELETE /media/<clave>). */
export interface UsageRef {
	resource: string;
	id: number;
	label: string;
	field: string;
}

export class BackendError extends Error {
	constructor(
		readonly status: number,
		readonly issues: FieldIssue[] = [],
		readonly usedBy: UsageRef[] = [],
	) {
		super(`El backend respondio ${status}`);
		this.name = "BackendError";
	}
}

export interface BackendRequest {
	method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
	/** Objeto JSON, o bytes si se indica `contentType`. */
	body?: unknown;
	/** Tipo del cuerpo cuando NO es JSON (p. ej. `image/webp`). */
	contentType?: string;
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

/** Avisos por campo de un 400 de Zod, reducidos a ruta + mensaje (sin otros datos). */
export const sanitizeIssues = (payload: unknown): FieldIssue[] => {
	const raw = (payload as { errors?: unknown })?.errors;
	if (!Array.isArray(raw)) return [];
	return raw.slice(0, 50).flatMap((item) => {
		const { path, message } = (item ?? {}) as Record<string, unknown>;
		if (!Array.isArray(path) || typeof message !== "string") return [];
		const clean = path.filter(
			(p): p is string | number =>
				typeof p === "string" || typeof p === "number",
		);
		return [{ path: clean, message: message.slice(0, 200) }];
	});
};

/** Usos de una imagen de un 409, reducidos a campos conocidos y de tipo seguro. */
export const sanitizeUsage = (payload: unknown): UsageRef[] => {
	const raw = (payload as { data?: { usedBy?: unknown } })?.data?.usedBy;
	if (!Array.isArray(raw)) return [];
	return raw.slice(0, 100).flatMap((item) => {
		const { resource, id, label, field } = (item ?? {}) as Record<
			string,
			unknown
		>;
		if (
			typeof resource !== "string" ||
			typeof id !== "number" ||
			typeof label !== "string" ||
			typeof field !== "string"
		)
			return [];
		return [
			{
				resource: resource.slice(0, 40),
				id,
				label: label.slice(0, 200),
				field: field.slice(0, 40),
			},
		];
	});
};

export const callBackend = async <T = unknown>(
	path: string,
	{
		method = "GET",
		body,
		contentType,
		accessJwt,
		timeoutMs = TIMEOUT_MS,
	}: BackendRequest = {},
): Promise<T> => {
	const headers: Record<string, string> = {
		Authorization: `Bearer ${API_SECRET_TOKEN}`,
		Accept: "application/json",
	};
	if (accessJwt) headers["Cf-Access-Jwt-Assertion"] = accessJwt;
	// El CSRF de Hono trata una escritura SIN Content-Type como text/plain y la
	// bloquea: toda escritura lo lleva, incluso un DELETE sin cuerpo.
	if (method !== "GET")
		headers["Content-Type"] = contentType ?? "application/json";

	const isJson = contentType === undefined;
	const response = await fetch(buildBackendUrl(path), {
		method,
		headers,
		body:
			body === undefined
				? undefined
				: isJson
					? JSON.stringify(body)
					: (body as BodyInit),
		// Sin opcion `cache`: Workers no cachea fetch por defecto y rechaza esa
		// opcion si la bandera de compatibilidad no esta activa.
		signal: AbortSignal.timeout(timeoutMs),
	});

	if (!response.ok) {
		const body = [400, 409].includes(response.status)
			? await response.json().catch(() => null)
			: null;
		throw new BackendError(
			response.status,
			response.status === 400 ? sanitizeIssues(body) : [],
			response.status === 409 ? sanitizeUsage(body) : [],
		);
	}
	// Sin cuerpo (204) es valido.
	const text = await response.text();
	return (text ? JSON.parse(text) : undefined) as T;
};
