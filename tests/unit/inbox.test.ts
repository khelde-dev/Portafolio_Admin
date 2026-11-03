import { describe, expect, it, vi } from "vitest";
import {
	mailtoHref,
	phoneDigits,
	snippet,
	telHref,
	whatsappHref,
} from "@/lib/contact";

vi.mock("astro:env/server", () => ({
	BACKEND_URL: "https://api.example.dev/api",
	API_SECRET_TOKEN: "test-token-value",
}));
const { BackendError } = await import("@/server/backendClient");
const {
	describeFailure,
	loadBadges,
	loadDashboard,
	loadList,
	loadRecentActivity,
} = await import("@/server/data");

const req = (jwt?: string) =>
	new Request("http://localhost/", {
		headers: jwt ? { "Cf-Access-Jwt-Assertion": jwt } : {},
	});

describe("enlaces con datos de visitantes", () => {
	it("mailto codifica la direccion: un ? o & no cuela parametros", () => {
		expect(mailtoHref("ana@example.com")).toBe("mailto:ana%40example.com");
		const attack = mailtoHref("x?bcc=ladron@evil.com&subject=hola@a.com");
		expect(attack).not.toContain("?bcc");
		expect(attack).not.toContain("&subject");
		expect(attack.startsWith("mailto:x%3Fbcc")).toBe(true);
	});

	it("el asunto va codificado y es el unico parametro", () => {
		expect(mailtoHref("a@b.co", "Re: tu mensaje & más")).toBe(
			"mailto:a%40b.co?subject=Re%3A%20tu%20mensaje%20%26%20m%C3%A1s",
		);
	});

	it("telefono: solo digitos y un + inicial", () => {
		expect(phoneDigits("+52 (55) 1234-5678")).toBe("+525512345678");
		expect(phoneDigits("55 1234 5678")).toBe("5512345678");
		expect(phoneDigits("javascript:alert(1)")).toBe("1");
	});

	it("tel y WhatsApp solo se arman con numeros plausibles", () => {
		expect(telHref("+52 55 1234 5678")).toBe("tel:+525512345678");
		expect(telHref("123")).toBeNull();
		expect(whatsappHref("+52 55 1234 5678")).toBe("https://wa.me/525512345678");
		expect(whatsappHref("12")).toBeNull();
		expect(whatsappHref("1".repeat(16))).toBeNull();
	});

	it("snippet recorta, junta espacios y tolera vacios", () => {
		expect(snippet("  hola\n\n  mundo  ")).toBe("hola mundo");
		expect(snippet("x".repeat(100), 10)).toBe(`${"x".repeat(9)}…`);
		expect(snippet(null)).toBe("");
	});
});

describe("describeFailure", () => {
	it("401/403/503 apuntan a Estado; lo demas es generico", () => {
		for (const status of [401, 403, 503]) {
			expect(describeFailure(new BackendError(status))).toMatch(/Estado/);
		}
		expect(describeFailure(new BackendError(500))).toMatch(/No se pudo leer/);
		expect(describeFailure(new TypeError("fetch failed"))).toMatch(
			/No se pudo leer/,
		);
	});
});

describe("loadList", () => {
	it("devuelve data y reenvia el JWT de la peticion", async () => {
		const call = vi.fn().mockResolvedValue({ data: [{ id: 1 }] });
		const out = await loadList(req("jwt-1"), "/contact-messages", call);
		expect(out).toEqual({ data: [{ id: 1 }], error: null });
		expect(call).toHaveBeenCalledWith("/contact-messages", {
			accessJwt: "jwt-1",
		});
	});

	it("un fallo no lanza: devuelve un mensaje sin detalles ni token", async () => {
		const spy = vi.spyOn(console, "error").mockImplementation(() => {});
		const call = vi
			.fn()
			.mockRejectedValue(new Error("Bearer test-token-value"));
		const out = await loadList(req(), "/x", call);
		expect(out.data).toBeNull();
		expect(out.error).toMatch(/No se pudo leer/);
		expect(JSON.stringify(spy.mock.calls)).not.toContain("test-token-value");
		spy.mockRestore();
	});
});

describe("loadBadges", () => {
	it("lee los dos contadores", async () => {
		const call = vi
			.fn()
			.mockResolvedValueOnce({ data: { unread: 3 } })
			.mockResolvedValueOnce({ data: { pending: 2 } });
		expect(await loadBadges(req(), call)).toEqual({
			mensajes: 3,
			comentarios: 2,
		});
		expect(call.mock.calls[0][1].timeoutMs).toBe(3000);
	});

	it("un fallo en uno no afecta al otro, ni rompe el menu", async () => {
		const call = vi
			.fn()
			.mockRejectedValueOnce(new BackendError(503))
			.mockResolvedValueOnce({ data: { pending: 5 } });
		expect(await loadBadges(req(), call)).toEqual({
			mensajes: 0,
			comentarios: 5,
		});
	});

	it("valores raros cuentan como 0", async () => {
		const call = vi
			.fn()
			.mockResolvedValue({ data: { unread: "mucho", pending: -4 } });
		expect(await loadBadges(req(), call)).toEqual({
			mensajes: 0,
			comentarios: 0,
		});
	});
});

describe("loadDashboard", () => {
	it("junta mensajes, pendientes, borradores y el ultimo cambio", async () => {
		const call = vi
			.fn()
			.mockResolvedValueOnce({ data: { unread: 3 } })
			.mockResolvedValueOnce({ data: { pending: 1 } })
			.mockResolvedValueOnce({
				data: [
					{ status: "draft", updated_at: "2026-10-01 10:00:00" },
					{ status: "published", updated_at: "2026-11-02 09:30:00" },
					{ status: "draft", updated_at: "2026-09-01 08:00:00" },
				],
			});
		const out = await loadDashboard(req(), call);
		expect(out).toEqual({
			data: {
				unread: 3,
				pending: 1,
				drafts: 2,
				projects: 3,
				lastEdit: "2026-11-02 09:30:00",
			},
			error: null,
		});
	});

	it("sin proyectos no hay ultimo cambio", async () => {
		const call = vi
			.fn()
			.mockResolvedValueOnce({ data: { unread: 0 } })
			.mockResolvedValueOnce({ data: { pending: 0 } })
			.mockResolvedValueOnce({ data: [] });
		const out = await loadDashboard(req(), call);
		expect(out.data).toMatchObject({ drafts: 0, projects: 0, lastEdit: null });
	});

	it("si el backend falla devuelve un error, no lanza", async () => {
		const call = vi.fn().mockRejectedValue(new BackendError(503));
		const out = await loadDashboard(req(), call);
		expect(out.data).toBeNull();
		expect(out.error).toMatch(/Estado/);
	});
});

describe("loadRecentActivity", () => {
	const row = {
		id: 4,
		at: "2026-11-02 10:00:00",
		admin_email: "yo@example.com",
		action: "update",
		resource: "projects",
		resource_id: "7",
		summary: "Mi proyecto",
	};

	it("pide los ultimos N con el JWT de la peticion y se queda con lo valido", async () => {
		const call = vi.fn().mockResolvedValue({ data: [row, { id: "x" }, null] });
		const out = await loadRecentActivity(req("jwt-1"), 5, call);
		expect(out).toEqual([row]);
		expect(call).toHaveBeenCalledWith("/audit?limit=5", { accessJwt: "jwt-1" });
	});

	it("si el backend aun no tiene el historial, el Panel sigue: lista vacia", async () => {
		const call = vi.fn().mockRejectedValue(new BackendError(404));
		expect(await loadRecentActivity(req(), 5, call)).toEqual([]);
		const down = vi.fn().mockRejectedValue(new TypeError("red"));
		expect(await loadRecentActivity(req(), 5, down)).toEqual([]);
	});
});
