import { describe, expect, it, vi } from "vitest";
import { formatDateTime, fromEpoch, parseD1Date } from "@/lib/format";
import { backTarget, findNavItem, NAV } from "@/lib/nav";

vi.mock("astro:env/server", () => ({
	BACKEND_URL: "https://api.example.dev/api",
	API_SECRET_TOKEN: "test-token-value",
}));
const { BackendError } = await import("@/server/backendClient");
const { getBackendHealth, meetsVersion } = await import("@/server/status");

describe("fechas de D1", () => {
	it("el texto de D1 se interpreta como UTC", () => {
		expect(parseD1Date("2026-11-02 14:05:09")?.toISOString()).toBe(
			"2026-11-02T14:05:09.000Z",
		);
	});

	it("acepta ISO y rechaza lo que no es fecha", () => {
		expect(parseD1Date("2026-11-02T14:05:09Z")?.getUTCHours()).toBe(14);
		expect(parseD1Date("manana")).toBeNull();
		expect(parseD1Date(null)).toBeNull();
		expect(parseD1Date("")).toBeNull();
	});

	it("formatDateTime muestra una raya cuando no hay fecha", () => {
		expect(formatDateTime(null)).toBe("—");
		expect(formatDateTime("2026-11-02 14:05:09")).toMatch(/2026/);
	});

	it("fromEpoch convierte segundos", () => {
		expect(fromEpoch(0).toISOString()).toBe("1970-01-01T00:00:00.000Z");
	});
});

describe("menu", () => {
	const items = NAV.flatMap((g) => g.items);

	it("ids y rutas sin repetir; toda ruta empieza con /", () => {
		expect(new Set(items.map((i) => i.id)).size).toBe(items.length);
		expect(new Set(items.map((i) => i.href)).size).toBe(items.length);
		for (const item of items) expect(item.href.startsWith("/")).toBe(true);
	});

	it("findNavItem encuentra por id", () => {
		expect(findNavItem("mensajes")?.href).toBe("/mensajes");
		expect(findNavItem("nada")).toBeUndefined();
	});
});

describe("version del backend", () => {
	it("compara por segmentos numericos", () => {
		expect(meetsVersion("0.8.1", "0.8.1")).toBe(true);
		expect(meetsVersion("0.10.0", "0.9.5")).toBe(true);
		expect(meetsVersion("0.8.0", "0.8.1")).toBe(false);
		expect(meetsVersion("1.0", "0.9.9")).toBe(true);
		expect(meetsVersion(null)).toBe(false);
	});
});

describe("getBackendHealth", () => {
	it("lee la version y mide el tiempo", async () => {
		let t = 100;
		const health = await getBackendHealth(
			(async () => ({ version: "0.9.0" })) as never,
			() => {
				t += 25;
				return t;
			},
		);
		expect(health).toEqual({
			ok: true,
			version: "0.9.0",
			ms: 25,
			status: null,
		});
	});

	it("un error del backend se reporta con su estado, sin lanzar", async () => {
		const health = await getBackendHealth((async () => {
			throw new BackendError(503);
		}) as never);
		expect(health).toMatchObject({ ok: false, status: 503, version: null });
	});

	it("un fallo de red se reporta sin estado", async () => {
		const health = await getBackendHealth((async () => {
			throw new TypeError("fetch failed");
		}) as never);
		expect(health).toMatchObject({ ok: false, status: null });
	});
});

describe("backTarget (el boton Volver)", () => {
	it("lleva al nivel de arriba: la ultima miga con enlace antes de la pagina actual", () => {
		expect(
			backTarget([
				{ label: "Proyectos", href: "/proyectos" },
				{ label: "Editar" },
			]),
		).toEqual({ label: "Proyectos", href: "/proyectos" });
		expect(
			backTarget([
				{ label: "Mensajes", href: "/mensajes" },
				{ label: "Hilo", href: "/mensajes/3" },
				{ label: "Responder" },
			]),
		).toEqual({ label: "Hilo", href: "/mensajes/3" });
	});

	it("en una pantalla de modulo o sin enlaces no hay a donde volver", () => {
		expect(backTarget([])).toBeUndefined();
		expect(backTarget([{ label: "Proyectos" }])).toBeUndefined();
		expect(
			backTarget([{ label: "Proyectos" }, { label: "Editar" }]),
		).toBeUndefined();
	});
});
