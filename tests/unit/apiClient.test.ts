import { describe, expect, it, vi } from "vitest";
import { ApiFailure, apiRequest } from "@/lib/apiClient";
import { issuesToFieldErrors } from "@/lib/formErrors";

const reply = (body: unknown, status = 200) =>
	vi.fn().mockResolvedValue(Response.json(body, { status }));

describe("apiRequest", () => {
	it("GET devuelve data y no manda Content-Type", async () => {
		const fetcher = reply({ data: [1, 2] });
		expect(
			await apiRequest("GET", "/api/projects", undefined, fetcher),
		).toEqual([1, 2]);
		const init = fetcher.mock.calls[0][1];
		expect(init.method).toBe("GET");
		expect(init.headers).not.toHaveProperty("Content-Type");
		expect(init.credentials).toBe("same-origin");
	});

	it("toda escritura manda application/json, incluso un DELETE sin cuerpo", async () => {
		const fetcher = reply({ data: null });
		await apiRequest("DELETE", "/api/projects/3", undefined, fetcher);
		expect(fetcher.mock.calls[0][1].headers["Content-Type"]).toBe(
			"application/json",
		);
		expect(fetcher.mock.calls[0][1].body).toBeUndefined();
		await apiRequest("PUT", "/api/projects/3", { a: 1 }, fetcher);
		expect(fetcher.mock.calls[1][1].body).toBe('{"a":1}');
	});

	it("un error trae el mensaje y los avisos por campo del servidor", async () => {
		const fetcher = reply(
			{
				message: "Hay datos que no son válidos.",
				errors: [{ path: ["slug"], message: "Repetido" }],
			},
			400,
		);
		const error = (await apiRequest("POST", "/api/projects", {}, fetcher).catch(
			(e) => e,
		)) as ApiFailure;
		expect(error).toBeInstanceOf(ApiFailure);
		expect(error.status).toBe(400);
		expect(error.message).toBe("Hay datos que no son válidos.");
		expect(error.issues).toEqual([{ path: ["slug"], message: "Repetido" }]);
	});

	it("una respuesta que no es JSON da un mensaje generico", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(new Response("<html>", { status: 502 }));
		const error = (await apiRequest("GET", "/api/x", undefined, fetcher).catch(
			(e) => e,
		)) as ApiFailure;
		expect(error.status).toBe(502);
		expect(error.message).toMatch(/No se pudo completar/);
	});

	it("un fallo de red sugiere recargar (la sesion de Access pudo vencer)", async () => {
		const fetcher = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
		const error = (await apiRequest("GET", "/api/x", undefined, fetcher).catch(
			(e) => e,
		)) as ApiFailure;
		expect(error.status).toBe(0);
		expect(error.message).toMatch(/recarga la página/);
	});
});

describe("issuesToFieldErrors", () => {
	it("un campo simple conserva su nombre", () => {
		expect(issuesToFieldErrors([{ path: ["slug"], message: "x" }])).toEqual({
			fields: [{ name: "slug", message: "x" }],
			root: [],
		});
	});

	it("las traducciones se resuelven por idioma, no por posicion", () => {
		const out = issuesToFieldErrors(
			[{ path: ["translations", 1, "title"], message: "Muy largo" }],
			[{ locale: "en" }, { locale: "fr" }],
		);
		expect(out.fields).toEqual([
			{ name: "translations.fr.title", message: "Muy largo" },
		]);
	});

	it("un aviso sin ruta o sin traduccion que lo explique va al aviso general", () => {
		const out = issuesToFieldErrors(
			[
				{ path: [], message: "General" },
				{ path: ["translations", 5, "title"], message: "Perdido" },
				{ path: ["translations", 0], message: "Idioma repetido" },
			],
			[{ locale: "en" }],
		);
		expect(out.fields).toEqual([]);
		expect(out.root).toEqual(["General", "Perdido", "Idioma repetido"]);
	});

	it("rutas anidadas se unen con punto", () => {
		expect(
			issuesToFieldErrors([{ path: ["gallery", 2], message: "x" }]).fields[0]
				.name,
		).toBe("gallery.2");
	});
});
