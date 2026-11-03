import { describe, expect, it } from "vitest";
import { contactValues } from "@/lib/contentForms";
import { NAV } from "@/lib/nav";
import {
	type ContactRow,
	contactSchema,
	phoneDigits,
	whatsappUrl,
} from "@/schemas/contact";
import { findResource } from "@/server/resources";

const VALID = {
	github_url: "https://github.com/muke78",
	linkedin_url: "https://www.linkedin.com/in/alguien/",
	linkedin_name: "Erick Gonzalez",
	phone: "+52 55 1190 9105",
	email: "persona@example.com",
};

describe("contactSchema", () => {
	it("acepta datos validos y normaliza el correo", () => {
		const parsed = contactSchema.parse({
			...VALID,
			email: "  Persona@Example.COM ",
		});
		expect(parsed.email).toBe("persona@example.com");
	});

	it.each([
		["http", "http://github.com/x"],
		["otro dominio", "https://evil.example/github.com"],
		["dominio que solo termina igual", "https://notgithub.com/x"],
		["javascript:", "javascript:alert(1)"],
		["sin esquema", "github.com/x"],
		["vacio", ""],
	])("GitHub rechaza: %s", (_name, github_url) => {
		expect(contactSchema.safeParse({ ...VALID, github_url }).success).toBe(
			false,
		);
	});

	it("acepta subdominios, y LinkedIn solo su dominio", () => {
		expect(
			contactSchema.safeParse({
				...VALID,
				github_url: "https://www.github.com/muke78",
				linkedin_url: "https://mx.linkedin.com/in/x",
			}).success,
		).toBe(true);
		expect(
			contactSchema.safeParse({
				...VALID,
				linkedin_url: "https://github.com/muke78",
			}).success,
		).toBe(false);
	});

	it.each([
		["sin +", "5511909105"],
		["con letras", "+52 abc 1190"],
		["muy corto", "+52 123"],
		["demasiados digitos", "+52 55 1190 9105 5555 5555"],
		["vacio", ""],
	])("telefono rechaza: %s", (_name, phone) => {
		expect(contactSchema.safeParse({ ...VALID, phone }).success).toBe(false);
	});

	it("pide cada dato y dice cual falta", () => {
		const result = contactSchema.safeParse({});
		expect(result.success).toBe(false);
		const fields = result.success
			? []
			: result.error.issues.map((i) => i.path[0]);
		expect(fields).toEqual(
			expect.arrayContaining([
				"github_url",
				"linkedin_url",
				"linkedin_name",
				"phone",
				"email",
			]),
		);
	});

	it("los campos que no son suyos no pasan", () => {
		const parsed = contactSchema.parse({ ...VALID, contact_id: 9 });
		expect(parsed).not.toHaveProperty("contact_id");
	});
});

describe("WhatsApp", () => {
	it("se arma con los digitos del telefono, sin guardarse", () => {
		expect(phoneDigits("+52 (55) 1190-9105")).toBe("525511909105");
		expect(whatsappUrl("+52 55 1190 9105")).toBe("https://wa.me/525511909105");
	});
});

describe("valores iniciales", () => {
	it("sin fila arranca vacio; con fila copia solo los cinco datos", () => {
		expect(contactValues(null)).toEqual({
			github_url: "",
			linkedin_url: "",
			linkedin_name: "",
			phone: "",
			email: "",
		});
		const row: ContactRow = {
			contact_id: 1,
			...VALID,
			created_at: "2026-01-01 00:00:00",
			updated_at: "2026-01-01 00:00:00",
		};
		expect(contactValues(row)).toEqual(VALID);
	});
});

describe("registro en el admin", () => {
	it("la ruta esta en la lista blanca como ficha unica que solo se edita", () => {
		const config = findResource("contact-info");
		expect(config).toMatchObject({
			listPath: "/contact-info/admin",
			basePath: "/contact-info",
			update: true,
			singleton: true,
		});
		expect(config?.remove).toBeFalsy();
		expect(config?.create).toBeFalsy();
	});

	it("el menu tiene Contacto en Sitio", () => {
		const group = NAV.find((g) => g.label === "Sitio");
		expect(group?.items.map((i) => i.id)).toContain("contacto");
	});
});
