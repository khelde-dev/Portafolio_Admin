/**
 * Cliente del NAVEGADOR para las rutas /api/* del propio admin (mismo origen).
 * Nunca llama al backend ni conoce su URL ni el token: eso vive en src/server.
 */
export interface ServerIssue {
	path: (string | number)[];
	message: string;
}

/** Donde se usa una imagen (respuesta 409 al borrarla). */
export interface ImageUsage {
	resource: string;
	id: number;
	label: string;
	field: string;
}

export class ApiFailure extends Error {
	constructor(
		readonly status: number,
		message: string,
		readonly issues: ServerIssue[] = [],
		readonly usedBy: ImageUsage[] = [],
		/** El formulario ya no esta al dia: otra edicion guardo primero. */
		readonly stale = false,
	) {
		super(message);
		this.name = "ApiFailure";
	}
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

const SESSION_HINT =
	"No se pudo conectar. Si la sesión venció, recarga la página para volver a entrar.";

/** `GET /api/projects` -> `data`. Lanza `ApiFailure` con un mensaje apto para mostrar. */
export const apiRequest = async <T = unknown>(
	method: Method,
	url: string,
	body?: unknown,
	fetcher: typeof fetch = fetch,
): Promise<T> => {
	let response: Response;
	try {
		response = await fetcher(url, {
			method,
			headers: {
				Accept: "application/json",
				// Tambien en DELETE sin cuerpo: el servidor lo exige (anti-CSRF).
				...(method === "GET" ? {} : { "Content-Type": "application/json" }),
			},
			body: body === undefined ? undefined : JSON.stringify(body),
			credentials: "same-origin",
		});
	} catch {
		// Cuando la sesion de Access vence, el login es de otro origen y el
		// navegador lo bloquea: llega como un fallo de red.
		throw new ApiFailure(0, SESSION_HINT);
	}

	let payload: {
		data?: T;
		message?: string;
		errors?: ServerIssue[];
		usedBy?: ImageUsage[];
		stale?: boolean;
	} | null = null;
	try {
		payload = await response.json();
	} catch {
		payload = null;
	}

	if (!response.ok) {
		throw new ApiFailure(
			response.status,
			payload?.message ?? "No se pudo completar la operación.",
			Array.isArray(payload?.errors) ? payload.errors : [],
			Array.isArray(payload?.usedBy) ? payload.usedBy : [],
			payload?.stale === true,
		);
	}
	return (payload?.data ?? null) as T;
};

export const api = {
	get: <T>(url: string) => apiRequest<T>("GET", url),
	post: <T>(url: string, body: unknown) => apiRequest<T>("POST", url, body),
	put: <T>(url: string, body: unknown) => apiRequest<T>("PUT", url, body),
	delete: <T>(url: string) => apiRequest<T>("DELETE", url),
};

/**
 * Sube una imagen WebP ya convertida: cuerpo BINARIO (no JSON ni multipart), con
 * `Content-Type: image/webp`. El servidor elige la clave y la devuelve.
 */
export interface UploadedImage {
	key: string;
	url: string | null;
	size: number;
	width: number;
	height: number;
}

export const apiUpload = async (
	folder: string,
	blob: Blob,
	fetcher: typeof fetch = fetch,
): Promise<UploadedImage> => {
	let response: Response;
	try {
		response = await fetcher(`/api/media?use=${encodeURIComponent(folder)}`, {
			method: "POST",
			headers: { Accept: "application/json", "Content-Type": "image/webp" },
			body: blob,
			credentials: "same-origin",
		});
	} catch {
		throw new ApiFailure(0, SESSION_HINT);
	}
	const payload = (await response.json().catch(() => null)) as {
		data?: UploadedImage;
		message?: string;
	} | null;
	if (!response.ok || !payload?.data) {
		throw new ApiFailure(
			response.status,
			payload?.message ?? "No se pudo subir la imagen.",
		);
	}
	return payload.data;
};
