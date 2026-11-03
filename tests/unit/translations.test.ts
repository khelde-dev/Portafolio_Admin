import { describe, expect, it } from "vitest";
import {
	completeness,
	isBlank,
	normalizeTranslations,
	type TranslationMap,
	toTranslationList,
	toTranslationMap,
} from "@/lib/translations";

describe("toTranslationList (mapa -> lista que espera el backend)", () => {
	it("convierte cada idioma con contenido", () => {
		expect(
			toTranslationList({
				en: { title: "Hello", summary: "Sum" },
				fr: { title: "Bonjour" },
			}),
		).toEqual([
			{ locale: "en", title: "Hello", summary: "Sum" },
			{ locale: "fr", title: "Bonjour" },
		]);
	});

	it("descarta idiomas sin ningun campo (no manda { locale } vacio)", () => {
		expect(
			toTranslationList({ en: { title: "", summary: "   " }, fr: {} }),
		).toEqual([]);
		expect(toTranslationList(undefined)).toEqual([]);
		expect(toTranslationList(null)).toEqual([]);
	});

	it("quita los campos vacios y nulos, y recorta espacios", () => {
		expect(
			toTranslationList({
				en: { title: "  Hi  ", summary: "", description: null },
			}),
		).toEqual([{ locale: "en", title: "Hi" }]);
	});

	it("solo sale en y fr, nunca es", () => {
		const map = {
			es: { title: "no" },
			en: { title: "yes" },
		} as unknown as TranslationMap;
		expect(toTranslationList(map)).toEqual([{ locale: "en", title: "yes" }]);
	});
});

describe("toTranslationMap (lista -> mapa para editar)", () => {
	it("agrupa por idioma", () => {
		expect(
			toTranslationMap([
				{ locale: "en", title: "Hello" },
				{ locale: "fr", title: "Bonjour" },
			]),
		).toEqual({ en: { title: "Hello" }, fr: { title: "Bonjour" } });
	});

	it("ignora es y tolera entradas ausentes", () => {
		expect(toTranslationMap([{ locale: "es", title: "x" }])).toEqual({});
		expect(toTranslationMap(undefined)).toEqual({});
	});
});

describe("ida y vuelta", () => {
	it("lista -> mapa -> lista no pierde nada", () => {
		const list = [
			{ locale: "en" as const, title: "A", summary: "B" },
			{ locale: "fr" as const, title: "C" },
		];
		expect(toTranslationList(toTranslationMap(list))).toEqual(list);
	});

	it("mapa -> lista -> mapa conserva lo que tiene contenido", () => {
		const map: TranslationMap = {
			en: { title: "A" },
			fr: { title: "C", summary: "D" },
		};
		expect(toTranslationMap(toTranslationList(map))).toEqual(map);
	});
});

describe("normalizeTranslations (lo que entrega el backend)", () => {
	it("deja solo en/fr y los campos conocidos de tipo texto", () => {
		expect(
			normalizeTranslations(
				{
					es: { title: "no" },
					en: { title: "Hi", summary: null, extra: "x", description: "d" },
					fr: "roto",
				},
				["title", "summary", "description"],
			),
		).toEqual({ en: { title: "Hi", description: "d" } });
	});

	it("tolera basura", () => {
		expect(normalizeTranslations(null, ["title"])).toEqual({});
		expect(normalizeTranslations("x", ["title"])).toEqual({});
		expect(normalizeTranslations(undefined, ["title"])).toEqual({});
	});
});

describe("completeness", () => {
	it("completa, parcial o vacia segun los campos requeridos", () => {
		const required = ["title", "summary"];
		expect(completeness({ title: "a", summary: "b" }, required)).toBe(
			"complete",
		);
		expect(completeness({ title: "a", summary: " " }, required)).toBe(
			"partial",
		);
		expect(completeness({}, required)).toBe("empty");
		expect(completeness(undefined, required)).toBe("empty");
	});
});

describe("isBlank", () => {
	it("blanco = null, undefined o solo espacios; el cero no lo es", () => {
		expect(isBlank(null)).toBe(true);
		expect(isBlank(undefined)).toBe(true);
		expect(isBlank("  ")).toBe(true);
		expect(isBlank("a")).toBe(false);
		expect(isBlank(0)).toBe(false);
	});
});
