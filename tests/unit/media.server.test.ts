import { describe, expect, it, vi } from "vitest";
import {
	type BrowserApi,
	convertToWebp,
	fitWithin,
	formatBytes,
	ImageError,
} from "@/lib/webp";

vi.mock("astro:env/server", () => ({
	BACKEND_URL: "https://api.example.dev/api",
	API_SECRET_TOKEN: "tok-secreto-9f3a",
}));

const { BackendError, sanitizeUsage } = await import("@/server/backendClient");
const { deleteMedia, isSafeMediaKey, listMedia, looksLikeWebp, uploadMedia } =
	await import("@/server/mediaProxy");

const SITE = "http://localhost";

const webpBytes = (extra = 30) =>
	Uint8Array.from([
		...[..."RIFF"].map((c) => c.charCodeAt(0)),
		0,
		0,
		0,
		0,
		...[..."WEBP"].map((c) => c.charCodeAt(0)),
		...new Array(extra).fill(0),
	]);

const upload = (
	options: {
		body?: BodyInit;
		type?: string;
		query?: string;
		headers?: Record<string, string>;
	} = {},
) => {
	const request = new Request(
		`${SITE}/api/media${options.query ?? "?use=projects"}`,
		{
			method: "POST",
			headers: {
				"Content-Type": options.type ?? "image/webp",
				...options.headers,
			},
			body: options.body ?? webpBytes(),
		},
	);
	return { request, url: new URL(request.url), params: {} };
};

const ok = (data: unknown = {}) =>
	vi.fn().mockResolvedValue({ success: true, data });

describe("subida (/api/media)", () => {
	it("reenvia el WebP en binario con su tipo y el JWT, y devuelve 201", async () => {
		const call = ok({ key: "projects/a.webp" });
		const ctx = upload({ headers: { "Cf-Access-Jwt-Assertion": "jwt-1" } });
		const res = await uploadMedia(ctx, call);
		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({ data: { key: "projects/a.webp" } });
		const [path, init] = call.mock.calls[0];
		expect(path).toBe("/media?use=projects");
		expect(init).toMatchObject({
			method: "POST",
			contentType: "image/webp",
			accessJwt: "jwt-1",
		});
		expect(init.body).toBeInstanceOf(Uint8Array);
	});

	it.each([
		["otro origen", { headers: { Origin: "https://malo.example" } }, 403],
		["otro tipo", { type: "image/png" }, 415],
		["JSON", { type: "application/json" }, 415],
		["carpeta invalida", { query: "?use=../etc" }, 400],
		["sin carpeta", { query: "" }, 400],
		["vacio", { body: new Uint8Array(0) }, 400],
		[
			"no es WebP",
			{
				body: new TextEncoder().encode("<svg onload=alert(1)></svg>".repeat(5)),
			},
			400,
		],
		["mas de 2 MB", { body: new Uint8Array(2 * 1024 * 1024 + 1) }, 413],
	] as const)("rechaza %s (%i)", async (_name, options, status) => {
		const call = ok();
		const res = await uploadMedia(upload(options as never), call);
		expect(res.status).toBe(status);
		expect(call).not.toHaveBeenCalled();
	});

	it("un Content-Length declarado enorme se corta antes de leer", async () => {
		const call = ok();
		const res = await uploadMedia(
			upload({ headers: { "Content-Length": String(5 * 1024 * 1024) } }),
			call,
		);
		expect(res.status).toBe(413);
		expect(call).not.toHaveBeenCalled();
	});

	it("un error del backend se traduce y no filtra el token", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const res = await uploadMedia(
			upload(),
			vi.fn().mockRejectedValue(new BackendError(400)),
		);
		expect(res.status).toBe(400);
		const net = await uploadMedia(
			upload(),
			vi.fn().mockRejectedValue(new TypeError("Bearer tok-secreto-9f3a")),
		);
		expect(net.status).toBe(503);
		expect(await net.text()).not.toContain("tok-secreto-9f3a");
	});
});

describe("biblioteca y borrado", () => {
	it("lista con el JWT y un tiempo de espera mayor", async () => {
		const call = ok({ objects: [], truncated: false });
		const request = new Request(`${SITE}/api/media`, {
			headers: { "Cf-Access-Jwt-Assertion": "j" },
		});
		const res = await listMedia(
			{ request, url: new URL(request.url), params: {} },
			call,
		);
		expect(res.status).toBe(200);
		expect(call.mock.calls[0]).toEqual([
			"/media",
			expect.objectContaining({ accessJwt: "j", timeoutMs: 15000 }),
		]);
	});

	const del = (
		key: string | undefined,
		headers: Record<string, string> = {},
	) => {
		const request = new Request(`${SITE}/api/media/${key ?? ""}`, {
			method: "DELETE",
			headers: { "Content-Type": "application/json", ...headers },
		});
		return { request, url: new URL(request.url), params: { key } };
	};

	it("borra con la clave codificada por segmentos", async () => {
		const call = ok();
		const res = await deleteMedia(del("projects/mi imagen.webp"), call);
		expect(res.status).toBe(200);
		expect(call.mock.calls[0][0]).toBe("/media/projects/mi%20imagen.webp");
		expect(call.mock.calls[0][1].method).toBe("DELETE");
	});

	it.each([
		"",
		"../secreto",
		"a/../b.webp",
		"/abs.webp",
		"a//b.webp",
		"https://x/y.webp",
		"a\\b.webp",
		"x".repeat(513),
	])("rechaza la clave %j", async (key) => {
		const call = ok();
		expect((await deleteMedia(del(key), call)).status).toBe(400);
		expect(call).not.toHaveBeenCalled();
	});

	it("exige mismo origen y application/json", async () => {
		const call = ok();
		expect(
			(
				await deleteMedia(
					del("a.webp", { Origin: "https://malo.example" }),
					call,
				)
			).status,
		).toBe(403);
		const noType = new Request(`${SITE}/api/media/a.webp`, {
			method: "DELETE",
		});
		expect(
			(
				await deleteMedia(
					{
						request: noType,
						url: new URL(noType.url),
						params: { key: "a.webp" },
					},
					call,
				)
			).status,
		).toBe(415);
		expect(call).not.toHaveBeenCalled();
	});

	it("un 409 devuelve donde se usa la imagen, saneado", async () => {
		vi.spyOn(console, "error").mockImplementation(() => {});
		const usedBy = sanitizeUsage({
			data: {
				usedBy: [
					{
						resource: "projects",
						id: 3,
						label: "Mi proyecto",
						field: "card_image",
						extra: "x",
					},
					{ resource: 5, id: "no", label: "x", field: "y" },
				],
			},
		});
		const res = await deleteMedia(
			del("a.webp"),
			vi.fn().mockRejectedValue(new BackendError(409, [], usedBy)),
		);
		expect(res.status).toBe(409);
		expect(await res.json()).toEqual({
			message: "La imagen está en uso.",
			usedBy: [
				{
					resource: "projects",
					id: 3,
					label: "Mi proyecto",
					field: "card_image",
				},
			],
		});
	});
});

describe("ayudas", () => {
	it("isSafeMediaKey y looksLikeWebp", () => {
		expect(isSafeMediaKey("projects/a.webp")).toBe(true);
		expect(isSafeMediaKey("a/./b")).toBe(false);
		expect(looksLikeWebp(webpBytes())).toBe(true);
		expect(looksLikeWebp(new Uint8Array(50))).toBe(false);
		expect(looksLikeWebp(webpBytes(0))).toBe(false);
	});

	it("sanitizeUsage tolera basura", () => {
		expect(sanitizeUsage(null)).toEqual([]);
		expect(sanitizeUsage({ data: { usedBy: "x" } })).toEqual([]);
	});
});

describe("conversion a WebP", () => {
	const png = (size = 1000) =>
		Object.assign(new Blob([new Uint8Array(size)], { type: "image/png" }), {
			name: "a.png",
		});
	const api = (
		sizes: number[],
		type = "image/webp",
		dims = { width: 4000, height: 2000 },
	) => {
		const encode = vi.fn();
		for (const size of sizes)
			encode.mockResolvedValueOnce(new Blob([new Uint8Array(size)], { type }));
		const decode = vi.fn().mockResolvedValue({ ...dims, close: vi.fn() });
		return { decode, encode } as unknown as BrowserApi & {
			decode: typeof decode;
			encode: typeof encode;
		};
	};

	it("fitWithin reduce el lado largo, conserva la proporcion y nunca agranda", () => {
		expect(fitWithin(4000, 2000, 1280)).toEqual({ width: 1280, height: 640 });
		expect(fitWithin(800, 600, 1280)).toEqual({ width: 800, height: 600 });
		expect(fitWithin(1, 5000, 100)).toEqual({ width: 1, height: 100 });
	});

	it("convierte a WebP, redimensiona y cierra la imagen decodificada", async () => {
		const browser = api([100 * 1024]);
		const result = await convertToWebp(png(2_000_000), "card", browser);
		expect(result).toMatchObject({
			width: 1280,
			height: 640,
			originalBytes: 2_000_000,
			quality: 0.82,
		});
		expect(result.blob.type).toBe("image/webp");
		expect(browser.encode).toHaveBeenCalledWith(
			expect.anything(),
			1280,
			640,
			0.82,
		);
		const decoded = await browser.decode.mock.results[0].value;
		expect(decoded.close).toHaveBeenCalled();
	});

	it("baja la calidad hasta que cabe en el tope de su uso", async () => {
		const browser = api([500 * 1024, 450 * 1024, 300 * 1024]);
		const result = await convertToWebp(png(), "card", browser);
		expect(result.quality).toBe(0.62);
		expect(browser.encode).toHaveBeenCalledTimes(3);
	});

	it("si ni la calidad mas baja cabe, dice el peso y el tope", async () => {
		const browser = api([900_000, 800_000, 700_000, 600_000]);
		await expect(convertToWebp(png(), "card", browser)).rejects.toThrow(
			/tope es 400 KB/,
		);
	});

	it("un navegador que devuelve PNG (Safari) se rechaza: nunca se sube otro formato", async () => {
		const browser = api([1000], "image/png");
		await expect(convertToWebp(png(), "card", browser)).rejects.toThrow(
			/Chrome, Edge o Firefox/,
		);
		const none = {
			decode: vi.fn().mockResolvedValue({ width: 1, height: 1 }),
			encode: vi.fn().mockResolvedValue(null),
		};
		await expect(
			convertToWebp(png(), "card", none as never),
		).rejects.toBeInstanceOf(ImageError);
	});

	it("rechaza SVG, GIF y formatos desconocidos con un mensaje que explica por que", async () => {
		const mk = (type: string) =>
			Object.assign(new Blob(["x"], { type }), { name: "x" });
		await expect(
			convertToWebp(mk("image/svg+xml"), "card", api([1])),
		).rejects.toThrow(/SVG/);
		await expect(
			convertToWebp(mk("image/gif"), "card", api([1])),
		).rejects.toThrow(/GIF/);
		await expect(
			convertToWebp(mk("application/pdf"), "card", api([1])),
		).rejects.toThrow(/Formato no admitido/);
	});

	it("rechaza un archivo gigante sin decodificarlo y una imagen danada", async () => {
		const browser = api([1]);
		const huge = Object.assign(
			new Blob([new Uint8Array(1)], { type: "image/png" }),
			{ name: "h" },
		);
		Object.defineProperty(huge, "size", { value: 30 * 1024 * 1024 });
		await expect(convertToWebp(huge, "card", browser)).rejects.toThrow(
			/máximo/,
		);
		expect(browser.decode).not.toHaveBeenCalled();

		const broken = {
			decode: vi.fn().mockRejectedValue(new Error("x")),
			encode: vi.fn(),
		};
		await expect(convertToWebp(png(), "card", broken as never)).rejects.toThrow(
			/dañada/,
		);
	});

	it("cada uso tiene su lado maximo", async () => {
		const logo = api([10_000], "image/webp", { width: 2000, height: 2000 });
		const result = await convertToWebp(png(), "logo", logo);
		expect(result).toMatchObject({ width: 512, height: 512 });
	});

	it("formatBytes", () => {
		expect(formatBytes(2048)).toBe("2 KB");
		expect(formatBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");
	});
});
