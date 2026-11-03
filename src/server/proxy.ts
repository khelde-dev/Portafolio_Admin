import {
	isJsonContentType,
	isSameOrigin,
	readJsonBody,
} from "@/lib/requestGuards";
import { resourceId } from "@/schemas/common";
import { orderSchema } from "@/schemas/content";
import {
	BackendError,
	callBackend,
	type FieldIssue,
	rejectionMessage,
} from "@/server/backendClient";
import { findResource, type ResourceConfig } from "@/server/resources";

/** Lo que ve la persona cuando el formulario que tenia abierto ya no esta al dia. */
export const STALE_MESSAGE =
	"Este elemento cambió desde que lo abriste, quizá en otra pestaña. Recarga para ver la versión nueva; lo que escribiste aquí se perderá.";

export type Op = "list" | "create" | "update" | "remove" | "order";

export interface ProxyContext {
	request: Request;
	url: URL;
	params: Record<string, string | undefined>;
}

type Call = typeof callBackend;

const json = (body: unknown, status = 200, headers?: HeadersInit) =>
	Response.json(body, { status, headers });

const fail = (status: number, message: string, issues: FieldIssue[] = []) =>
	json(issues.length > 0 ? { message, errors: issues } : { message }, status);

const ALLOWED: Record<Op, keyof ResourceConfig> = {
	list: "listPath",
	create: "create",
	update: "update",
	remove: "remove",
	order: "order",
};

const isAllowed = (config: ResourceConfig, op: Op): boolean =>
	op === "list" ? true : Boolean(config[ALLOWED[op]]);

const METHODS: Record<Op, string> = {
	list: "GET",
	create: "POST",
	update: "PUT",
	remove: "DELETE",
	order: "PUT",
};

/** Traduce el fallo del backend a una respuesta que el navegador puede ver. */
export const mapBackendError = (
	error: unknown,
	config: ResourceConfig,
): Response => {
	if (!(error instanceof BackendError)) {
		// Red caida, tiempo agotado... sin detalle hacia fuera.
		return fail(503, "No se pudo contactar con el backend. Intenta de nuevo.");
	}
	switch (error.status) {
		case 400:
			return fail(400, "Hay datos que no son válidos.", error.issues);
		case 404:
			return fail(404, "Ese elemento ya no existe.");
		case 409:
			// Otra pestana (u otra sesion) guardo primero: no es un valor repetido.
			if (error.reason === "stale") {
				return json({ message: STALE_MESSAGE, stale: true }, 409);
			}
			return fail(
				409,
				config.conflictField?.message ?? "Ese valor ya existe.",
				config.conflictField
					? [
							{
								path: [config.conflictField.path],
								message: config.conflictField.message,
							},
						]
					: [],
			);
		case 401:
		case 403:
		case 503:
			// El backend rechazo al admin (token, Access sin configurar): es un
			// problema de configuracion, no del usuario.
			return fail(502, rejectionMessage(error.reason));
		default:
			return fail(502, "El backend respondió con un error. Intenta de nuevo.");
	}
};

/**
 * Atiende `GET|POST|PUT|DELETE /api/<recurso>[/<id>]`. En este orden: recurso y
 * metodo en la lista blanca, mismo origen, tipo y tamano del cuerpo, esquema,
 * y solo entonces la llamada al backend con el JWT de Access de la peticion.
 * La identidad ya la verifico el middleware.
 */
export const handleResource = async (
	ctx: ProxyContext,
	op: Op,
	call: Call = callBackend,
): Promise<Response> => {
	const config = findResource(ctx.params.resource);
	if (!config) return fail(404, "Recurso no encontrado");
	if (!isAllowed(config, op)) {
		return json({ message: "Método no permitido" }, 405, { Allow: "GET" });
	}

	const writes = op !== "list";
	if (writes) {
		if (!isSameOrigin(ctx.request, ctx.url.origin))
			return fail(403, "Origen no permitido");
		// Tambien un DELETE sin cuerpo: asi un formulario ajeno no puede dispararlo.
		if (!isJsonContentType(ctx.request)) {
			return fail(415, "El contenido debe ser application/json");
		}
	}

	let id: number | undefined;
	if (op === "update" && !config.singleton) {
		const parsed = resourceId.safeParse(ctx.params.id);
		if (!parsed.success) return fail(400, "Identificador no válido");
		id = parsed.data;
	}
	if (op === "remove") {
		const parsed = resourceId.safeParse(ctx.params.id);
		if (!parsed.success) return fail(400, "Identificador no válido");
		id = parsed.data;
	}

	let body: unknown;
	if (op === "create" || op === "update" || op === "order") {
		const raw = await readJsonBody(ctx.request);
		if (raw.ok === false) return fail(raw.status, raw.message);
		const schema = op === "order" ? orderSchema : config.schema;
		if (!schema) return fail(405, "Método no permitido");
		const parsed = schema.safeParse(raw.value);
		if (!parsed.success) {
			return fail(
				400,
				"Hay datos que no son válidos.",
				parsed.error.issues.map((issue) => ({
					path: issue.path.filter(
						(p): p is string | number =>
							typeof p === "string" || typeof p === "number",
					),
					message: issue.message,
				})),
			);
		}
		body = parsed.data;
	}

	let path: string;
	if (op === "list") {
		let search = "";
		if (config.query) {
			const query = config.query.safeParse(
				Object.fromEntries(ctx.url.searchParams),
			);
			if (!query.success) return fail(400, "Filtro no válido");
			const entries = Object.entries(
				query.data as Record<string, string | undefined>,
			).filter(([, v]) => v !== undefined);
			if (entries.length > 0)
				search = `?${new URLSearchParams(entries as [string, string][])}`;
		}
		path = `${config.listPath}${search}`;
	} else if (op === "order") {
		path = `${config.basePath}/order`;
	} else if (id !== undefined) {
		path = `${config.basePath}/${id}`;
	} else {
		path = config.basePath;
	}

	try {
		const result = await call<{ data?: unknown }>(path, {
			method: METHODS[op] as "GET" | "POST" | "PUT" | "DELETE",
			body,
			accessJwt: ctx.request.headers.get("Cf-Access-Jwt-Assertion"),
		});
		return json({ data: result?.data ?? null }, op === "create" ? 201 : 200);
	} catch (error) {
		// Solo recurso, operacion y estado: nunca cuerpo, cabeceras ni datos.
		console.error(
			`admin ${op} ${ctx.params.resource} ->`,
			error instanceof BackendError ? error.status : "sin respuesta",
		);
		return mapBackendError(error, config);
	}
};
