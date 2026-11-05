import {
	BackendError,
	callBackend,
	type FailReason,
	rejectionMessage,
} from "@/server/backendClient";

export interface BackendHealth {
	ok: boolean;
	version: string | null;
	/** Milisegundos que tardo en responder. */
	ms: number;
	/** Estado HTTP si respondio con error. */
	status: number | null;
}

/**
 * `GET /api` del backend es publico (responde antes del bearer): sirve para
 * saber si esta vivo y que version corre, sin gastar una consulta de datos.
 */
/** `binding` = por el Service Binding (sin salir a internet); `url` = por la URL publica. */
export { backendChannel } from "@/server/backendClient";

export const getBackendHealth = async (
	call: typeof callBackend = callBackend,
	now: () => number = Date.now,
): Promise<BackendHealth> => {
	const started = now();
	try {
		const data = await call<{ version?: unknown }>("/", { timeoutMs: 4000 });
		return {
			ok: true,
			version: typeof data?.version === "string" ? data.version : null,
			ms: now() - started,
			status: null,
		};
	} catch (error) {
		return {
			ok: false,
			version: null,
			ms: now() - started,
			status: error instanceof BackendError ? error.status : null,
		};
	}
};

/** Version minima del backend que este admin necesita (se sube con cada fase). */
export const MIN_BACKEND_VERSION = "0.12.0";

const parts = (version: string) =>
	version.split(".").map((n) => Number.parseInt(n, 10) || 0);

/** `true` si `version` >= `min` (comparacion numerica por segmentos). */
export const meetsVersion = (
	version: string | null,
	min = MIN_BACKEND_VERSION,
): boolean => {
	if (!version) return false;
	const a = parts(version);
	const b = parts(min);
	for (let i = 0; i < Math.max(a.length, b.length); i++) {
		const diff = (a[i] ?? 0) - (b[i] ?? 0);
		if (diff !== 0) return diff > 0;
	}
	return true;
};

export interface AuthProbe {
	ok: boolean;
	status: number | null;
	reason: FailReason | null;
	/** Que pasa y donde se arregla (vacio si todo bien). */
	hint: string;
}

/**
 * Una peticion REAL a una ruta del CMS (`unread-count`, barata) con el token y el
 * JWT de la peticion: es lo que de verdad falla cuando "las pantallas no cargan".
 * `GET /api` es publico y no prueba nada de esto.
 */
export const probeBackendAuth = async (
	request: Request,
	call: typeof callBackend = callBackend,
): Promise<AuthProbe> => {
	try {
		await call("/contact-messages/unread-count", {
			accessJwt: request.headers.get("Cf-Access-Jwt-Assertion"),
			timeoutMs: 4000,
		});
		return { ok: true, status: null, reason: null, hint: "" };
	} catch (error) {
		if (error instanceof BackendError) {
			return {
				ok: false,
				status: error.status,
				reason: error.reason,
				hint:
					error.status === 401 || error.status === 403 || error.status === 503
						? rejectionMessage(error.reason)
						: `El backend respondió con el estado ${error.status}.`,
			};
		}
		return {
			ok: false,
			status: null,
			reason: null,
			hint: "No hubo respuesta del backend.",
		};
	}
};
