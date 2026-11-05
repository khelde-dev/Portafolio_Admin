import { isSameOrigin } from "@/lib/requestGuards";
import { BackendError, callBackend } from "@/server/backendClient";
import { mapBackendError } from "@/server/proxy";

/**
 * Ruta /api/cv: el curriculum en PDF. Igual que /api/media, la subida es binaria (no
 * JSON): mismo origen, tipo exacto, tope de tamano y firma real del archivo antes de
 * reenviar (el backend vuelve a mirar todo). La identidad ya la verifico el middleware.
 */
type Call = typeof callBackend;

export const MAX_CV_BYTES = 5 * 1024 * 1024;

export interface CvContext {
	request: Request;
	url: URL;
	params: Record<string, string | undefined>;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
const fail = (status: number, message: string) => json({ message }, status);
const jwtOf = (request: Request) =>
	request.headers.get("Cf-Access-Jwt-Assertion");

/** Un PDF empieza con `%PDF-`: una comprobacion barata antes de reenviar. */
export const looksLikePdf = (bytes: Uint8Array): boolean =>
	bytes.length >= 8 &&
	[..."%PDF-"].every((c, i) => bytes[i] === c.charCodeAt(0));

const backendError = (error: unknown, op: string): Response => {
	console.error(
		`admin cv ${op} ->`,
		error instanceof BackendError ? error.status : "sin respuesta",
	);
	if (error instanceof BackendError && error.status === 409) {
		return fail(
			409,
			"Guarda primero los textos del sitio y después sube el currículum.",
		);
	}
	if (error instanceof BackendError && error.status === 404) {
		return fail(404, "No hay currículum cargado.");
	}
	return mapBackendError(error, { listPath: "", basePath: "" });
};

export const getCv = async (
	ctx: CvContext,
	call: Call = callBackend,
): Promise<Response> => {
	try {
		const result = await call<{ data?: unknown }>("/cv", {
			accessJwt: jwtOf(ctx.request),
		});
		return json({ data: result?.data ?? null });
	} catch (error) {
		return backendError(error, "get");
	}
};

export const uploadCv = async (
	ctx: CvContext,
	call: Call = callBackend,
): Promise<Response> => {
	const { request, url } = ctx;
	if (!isSameOrigin(request, url.origin))
		return fail(403, "Origen no permitido");

	const type = (request.headers.get("content-type") ?? "")
		.split(";")[0]
		.trim()
		.toLowerCase();
	if (type !== "application/pdf")
		return fail(415, "Solo se aceptan archivos PDF");

	const declared = Number(request.headers.get("content-length") ?? 0);
	if (Number.isFinite(declared) && declared > MAX_CV_BYTES) {
		return fail(413, "El PDF supera los 5 MB");
	}

	const bytes = new Uint8Array(await request.arrayBuffer());
	if (bytes.length === 0) return fail(400, "El archivo está vacío");
	if (bytes.length > MAX_CV_BYTES) return fail(413, "El PDF supera los 5 MB");
	if (!looksLikePdf(bytes)) return fail(400, "El archivo no es un PDF válido");

	try {
		const result = await call<{ data?: unknown }>("/cv", {
			method: "POST",
			body: bytes,
			contentType: "application/pdf",
			accessJwt: jwtOf(request),
			timeoutMs: 30_000,
		});
		return json({ data: result?.data ?? null }, 201);
	} catch (error) {
		return backendError(error, "upload");
	}
};

export const deleteCv = async (
	ctx: CvContext,
	call: Call = callBackend,
): Promise<Response> => {
	const { request, url } = ctx;
	if (!isSameOrigin(request, url.origin))
		return fail(403, "Origen no permitido");
	if (
		!/^application\/json(\s*;|$)/i.test(
			request.headers.get("content-type") ?? "",
		)
	) {
		return fail(415, "El contenido debe ser application/json");
	}
	try {
		await call("/cv", { method: "DELETE", accessJwt: jwtOf(request) });
		return json({ data: null });
	} catch (error) {
		return backendError(error, "delete");
	}
};
