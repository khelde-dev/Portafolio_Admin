import { API_SECRET_TOKEN, BACKEND_URL } from "astro:env/server";
import { devJwt } from "@/server/devAccess";

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

/**
 * Por que el backend rechazo al admin. Sale de los mensajes FIJOS del backend
 * (nunca se copia texto libre): distingue un token distinto (`bearer`) de un
 * problema con el JWT de Access, que se arreglan en sitios distintos.
 */
export type FailReason =
	| "bearer"
	| "access-missing"
	| "access-invalid"
	| "access-unconfigured"
	| "stale";

const REASONS: Record<string, FailReason> = {
	"Invalid token": "bearer",
	"No Authorization header": "bearer",
	"Invalid Authorization header": "bearer",
	"Falta la sesion de Cloudflare Access": "access-missing",
	"Sesion de Access invalida": "access-invalid",
	"Cloudflare Access no esta configurado": "access-unconfigured",
	// 409 al editar: la fila cambio desde que se abrio el formulario.
	"Este elemento cambió desde que lo abriste. Recarga para ver la versión nueva.":
		"stale",
};

export const classifyReason = (payload: unknown): FailReason | null => {
	const message = (payload as { message?: unknown })?.message;
	return typeof message === "string" && Object.hasOwn(REASONS, message)
		? REASONS[message]
		: null;
};

/** Que pasa y donde se arregla, segun el motivo que dio el backend. */
export const rejectionMessage = (reason: FailReason | null): string => {
	switch (reason) {
		case "bearer":
			return "El backend no aceptó el token. API_SECRET_TOKEN del admin debe valer lo mismo que API_TOKEN del backend.";
		case "access-unconfigured":
			return "El backend no tiene Cloudflare Access configurado (ACCESS_AUD y ACCESS_TEAM_DOMAIN). En local: corre pnpm dev:access en la carpeta del admin (Portafolio_admin), pega las líneas ACCESS_* que imprime en el .env del backend y reinicia el backend.";
		case "access-missing":
			return "El admin no mandó el JWT de Access. En local: corre pnpm dev:access en la carpeta del admin (Portafolio_admin), pega DEV_ACCESS_KEY en el .env del admin y reinicia el admin.";
		case "access-invalid":
			return "El backend no aceptó el JWT de Access (audiencia, emisor o llave distintos). En local: pega en el .env del backend las líneas ACCESS_* que imprime pnpm dev:access (se corre en Portafolio_admin) y reinicia ambos.";
		default:
			return "El backend rechazó la petición. Revisa la pantalla Estado.";
	}
};

export class BackendError extends Error {
	constructor(
		readonly status: number,
		readonly issues: FieldIssue[] = [],
		readonly usedBy: UsageRef[] = [],
		readonly reason: FailReason | null = null,
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
	// En `pnpm dev` no hay Access: se firma un JWT de prueba (src/server/devAccess).
	// `import.meta.env.DEV` es `false` en el build, asi que esto no existe en produccion.
	const jwt = accessJwt ?? (import.meta.env.DEV ? await devJwt() : null);
	if (jwt) headers["Cf-Access-Jwt-Assertion"] = jwt;
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
		const body = [400, 401, 403, 409, 503].includes(response.status)
			? await response.json().catch(() => null)
			: null;
		throw new BackendError(
			response.status,
			response.status === 400 ? sanitizeIssues(body) : [],
			response.status === 409 ? sanitizeUsage(body) : [],
			[401, 403, 409, 503].includes(response.status)
				? classifyReason(body)
				: null,
		);
	}
	// Sin cuerpo (204) es valido.
	const text = await response.text();
	return (text ? JSON.parse(text) : undefined) as T;
};
