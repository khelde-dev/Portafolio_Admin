import { describe, expect, it } from "vitest";
import {
	type AuditEntry,
	describeEntry,
	isKnownResource,
	parseAudit,
	RESOURCE_OPTIONS,
} from "@/lib/activity";
import { NAV } from "@/lib/nav";

const entry = (over: Partial<AuditEntry> = {}): AuditEntry => ({
	id: 1,
	at: "2026-01-01 10:00:00",
	admin_email: "yo@example.com",
	action: "update",
	resource: "projects",
	resource_id: "7",
	summary: "Mi proyecto",
	...over,
});

describe("describeEntry", () => {
	it("editar un proyecto lleva a su pantalla", () => {
		expect(describeEntry(entry())).toEqual({
			verb: "editó",
			label: "proyecto",
			summary: "Mi proyecto",
			href: "/proyectos/7",
		});
	});

	it("crear tambien enlaza; borrar no (ya no existe)", () => {
		expect(describeEntry(entry({ action: "create" })).href).toBe(
			"/proyectos/7",
		);
		const removed = describeEntry(entry({ action: "delete" }));
		expect(removed.verb).toBe("borró");
		expect(removed.href).toBeNull();
	});

	it("cada recurso con pantalla de edicion enlaza a la suya", () => {
		const hrefs = {
			experiences: "/experiencia/7",
			education: "/educacion/7",
			skills: "/habilidades/7",
		};
		for (const [resource, href] of Object.entries(hrefs)) {
			expect(describeEntry(entry({ resource })).href).toBe(href);
		}
	});

	it("las fichas unicas y las bandejas enlazan a su lista", () => {
		const lists = {
			about: "/sobre-mi",
			"contact-info": "/contacto",
			comments: "/comentarios",
			"contact-messages": "/mensajes",
			media: "/medios",
		};
		for (const [resource, href] of Object.entries(lists)) {
			expect(describeEntry(entry({ resource, resource_id: "1" })).href).toBe(
				href,
			);
		}
	});

	it("una imagen se identifica por su clave, no por un numero", () => {
		const line = describeEntry(
			entry({
				resource: "media",
				resource_id: "projects/a.webp",
				action: "create",
			}),
		);
		expect(line.href).toBe("/medios");
	});

	it("reordenar se dice como tal y lleva a la lista", () => {
		const line = describeEntry(entry({ resource_id: "order", summary: null }));
		expect(line).toMatchObject({
			verb: "reordenó",
			label: "proyectos",
			href: "/proyectos",
		});
	});

	it("un recurso desconocido se muestra tal cual y sin enlace", () => {
		const line = describeEntry(entry({ resource: "algo-nuevo" }));
		expect(line.label).toBe("algo-nuevo");
		expect(line.href).toBeNull();
	});

	it("un id raro no arma un enlace a otra parte", () => {
		const line = describeEntry(entry({ resource_id: "../../x" }));
		expect(line.href).toBe("/proyectos");
	});
});

describe("parseAudit", () => {
	it("descarta lo que no tiene la forma esperada", () => {
		expect(parseAudit(null)).toEqual([]);
		expect(parseAudit({})).toEqual([]);
		const good = entry();
		expect(
			parseAudit([good, null, { id: "x" }, { ...good, action: "hack" }]),
		).toEqual([good]);
	});
});

describe("filtro por recurso", () => {
	it("solo acepta recursos conocidos (el valor viene de la URL)", () => {
		expect(isKnownResource("projects")).toBe(true);
		expect(isKnownResource("__proto__")).toBe(false);
		expect(isKnownResource("toString")).toBe(false);
		expect(isKnownResource(null)).toBe(false);
		expect(RESOURCE_OPTIONS.length).toBeGreaterThanOrEqual(9);
	});
});

describe("menu", () => {
	it("Actividad esta en Sistema, antes de Estado", () => {
		const group = NAV.find((g) => g.label === "Sistema");
		const ids = group?.items.map((i) => i.id) ?? [];
		expect(ids).toContain("actividad");
		expect(ids.indexOf("actividad")).toBeLessThan(ids.indexOf("estado"));
	});
});
