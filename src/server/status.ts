import { BackendError, callBackend } from "@/server/backendClient";

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
export const MIN_BACKEND_VERSION = "0.8.1";

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
