import {
	BackendError,
	callBackend,
	rejectionMessage,
} from "@/server/backendClient";

/**
 * Lecturas del backend para las PAGINAS (SSR): traen los datos iniciales de una
 * pantalla y los globos del menu. Siempre con el JWT de Access de la peticion en
 * curso. Un fallo no tumba la pagina: devuelve `error` y la isla muestra su
 * estado de error con "Reintentar".
 */
type Call = typeof callBackend;

export type Loaded<T> =
	| { data: T; error: null }
	| { data: null; error: string };

const jwtOf = (request: Request) =>
	request.headers.get("Cf-Access-Jwt-Assertion");

/** Mensaje apto para mostrar (sin detalles del backend). */
export const describeFailure = (error: unknown): string =>
	error instanceof BackendError &&
	(error.status === 401 || error.status === 403 || error.status === 503)
		? rejectionMessage(error.reason)
		: "No se pudo leer el backend. Intenta de nuevo.";

/** `GET <path>` -> `data` del backend, o un mensaje de error. */
export const loadList = async <T>(
	request: Request,
	path: string,
	call: Call = callBackend,
): Promise<Loaded<T>> => {
	try {
		const result = await call<{ data?: T }>(path, {
			accessJwt: jwtOf(request),
		});
		return { data: (result?.data ?? null) as T, error: null };
	} catch (error) {
		console.error(
			`admin carga ${path} ->`,
			error instanceof BackendError ? error.status : "sin respuesta",
		);
		return { data: null, error: describeFailure(error) };
	}
};

/** Globos del menu: `{ mensajes, comentarios }`. Un fallo es 0 (el menu nunca se rompe). */
export const loadBadges = async (
	request: Request,
	call: Call = callBackend,
): Promise<Record<string, number>> => {
	const accessJwt = jwtOf(request);
	const opts = { accessJwt, timeoutMs: 3000 };
	const [unread, pending] = await Promise.allSettled([
		call<{ data?: { unread?: number } }>(
			"/contact-messages/unread-count",
			opts,
		),
		call<{ data?: { pending?: number } }>("/comments/pending-count", opts),
	]);
	const num = (v: unknown) =>
		typeof v === "number" && Number.isFinite(v) && v > 0 ? v : 0;
	return {
		mensajes:
			unread.status === "fulfilled" ? num(unread.value?.data?.unread) : 0,
		comentarios:
			pending.status === "fulfilled" ? num(pending.value?.data?.pending) : 0,
	};
};

export interface DashboardData {
	unread: number;
	pending: number;
	drafts: number;
	projects: number;
	/** Fecha (texto de D1) del ultimo cambio en proyectos, o `null`. */
	lastEdit: string | null;
}

/** Numeros del Panel: lo que espera tu atencion. */
export const loadDashboard = async (
	request: Request,
	call: Call = callBackend,
): Promise<Loaded<DashboardData>> => {
	const accessJwt = jwtOf(request);
	try {
		const [unread, pending, projects] = await Promise.all([
			call<{ data?: { unread?: number } }>("/contact-messages/unread-count", {
				accessJwt,
			}),
			call<{ data?: { pending?: number } }>("/comments/pending-count", {
				accessJwt,
			}),
			call<{ data?: { status?: string; updated_at?: string }[] }>(
				"/projects/admin",
				{ accessJwt },
			),
		]);
		const rows = Array.isArray(projects?.data) ? projects.data : [];
		const dates = rows
			.map((r) => r.updated_at)
			.filter((d): d is string => typeof d === "string");
		return {
			data: {
				unread: unread?.data?.unread ?? 0,
				pending: pending?.data?.pending ?? 0,
				drafts: rows.filter((r) => r.status === "draft").length,
				projects: rows.length,
				lastEdit: dates.length > 0 ? (dates.sort().at(-1) ?? null) : null,
			},
			error: null,
		};
	} catch (error) {
		return { data: null, error: describeFailure(error) };
	}
};
