import { isSameOrigin } from "@/lib/requestGuards";
import { BackendError, callBackend } from "@/server/backendClient";
import { mapBackendError } from "@/server/proxy";

/**
 * Rutas /api/media: la unica parte del admin que NO habla JSON (la subida es
 * binaria). Mismas reglas que el resto: mismo origen, tipo exacto, tope de
 * tamano y la identidad ya verificada por el middleware.
 */
type Call = typeof callBackend;

export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const FOLDERS = [
	"projects",
	"experience",
	"education",
	"about",
	"site",
] as const;

export interface MediaContext {
	request: Request;
	url: URL;
	params: Record<string, string | undefined>;
}

const json = (body: unknown, status = 200) => Response.json(body, { status });
const fail = (status: number, message: string) => json({ message }, status);
const jwtOf = (request: Request) =>
	request.headers.get("Cf-Access-Jwt-Assertion");

/** Una clave de R2 que se pide borrar no puede salirse del bucket ni parecer una URL. */
export const isSafeMediaKey = (key: string): boolean =>
	key.length > 0 &&
	key.length <= 512 &&
	!key.startsWith("/") &&
	!key.includes("\\") &&
	!key.includes(":") &&
	!key.split("/").some((s) => s === ".." || s === "." || s === "") &&
	![...key].some((ch) => ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f);

/** `RIFF....WEBP`: una comprobacion barata antes de reenviar (el backend vuelve a mirar todo). */
export const looksLikeWebp = (bytes: Uint8Array): boolean => {
	if (bytes.length < 30) return false;
	const at = (i: number, text: string) =>
		[...text].every((c, k) => bytes[i + k] === c.charCodeAt(0));
	return at(0, "RIFF") && at(8, "WEBP");
};

const backendError = (error: unknown, op: string): Response => {
	console.error(
		`admin media ${op} ->`,
		error instanceof BackendError ? error.status : "sin respuesta",
	);
	if (error instanceof BackendError && error.status === 409) {
		return json(
			{ message: "La imagen está en uso.", usedBy: error.usedBy },
			409,
		);
	}
	return mapBackendError(error, { listPath: "", basePath: "" });
};

export const listMedia = async (
	ctx: MediaContext,
	call: Call = callBackend,
): Promise<Response> => {
	try {
		const result = await call<{ data?: unknown }>("/media", {
			accessJwt: jwtOf(ctx.request),
			timeoutMs: 15_000,
		});
		return json({ data: result?.data ?? null });
	} catch (error) {
		return backendError(error, "list");
	}
};

export const uploadMedia = async (
	ctx: MediaContext,
	call: Call = callBackend,
): Promise<Response> => {
	const { request, url } = ctx;
	if (!isSameOrigin(request, url.origin))
		return fail(403, "Origen no permitido");

	const folder = url.searchParams.get("use");
	if (!folder || !(FOLDERS as readonly string[]).includes(folder)) {
		return fail(400, "Carpeta no válida");
	}

	const type = (request.headers.get("content-type") ?? "")
		.split(";")[0]
		.trim()
		.toLowerCase();
	if (type !== "image/webp") return fail(415, "Solo se aceptan imágenes WebP");

	const declared = Number(request.headers.get("content-length") ?? 0);
	if (Number.isFinite(declared) && declared > MAX_UPLOAD_BYTES) {
		return fail(413, "La imagen supera los 2 MB");
	}

	const bytes = new Uint8Array(await request.arrayBuffer());
	if (bytes.length === 0) return fail(400, "La imagen está vacía");
	if (bytes.length > MAX_UPLOAD_BYTES)
		return fail(413, "La imagen supera los 2 MB");
	if (!looksLikeWebp(bytes))
		return fail(400, "El archivo no es un WebP válido");

	try {
		const result = await call<{ data?: unknown }>(`/media?use=${folder}`, {
			method: "POST",
			body: bytes,
			contentType: "image/webp",
			accessJwt: jwtOf(request),
			timeoutMs: 30_000,
		});
		return json({ data: result?.data ?? null }, 201);
	} catch (error) {
		return backendError(error, "upload");
	}
};

export const deleteMedia = async (
	ctx: MediaContext,
	call: Call = callBackend,
): Promise<Response> => {
	const { request, url, params } = ctx;
	if (!isSameOrigin(request, url.origin))
		return fail(403, "Origen no permitido");
	if (
		!/^application\/json(\s*;|$)/i.test(
			request.headers.get("content-type") ?? "",
		)
	) {
		return fail(415, "El contenido debe ser application/json");
	}

	const key = params.key ?? "";
	if (!isSafeMediaKey(key)) return fail(400, "Clave de imagen no válida");

	try {
		const encoded = key.split("/").map(encodeURIComponent).join("/");
		await call(`/media/${encoded}`, {
			method: "DELETE",
			accessJwt: jwtOf(request),
		});
		return json({ data: { key } });
	} catch (error) {
		return backendError(error, "delete");
	}
};
