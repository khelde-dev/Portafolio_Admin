import { describe, expect, it, vi } from "vitest";
import { moveItem } from "@/hooks/useReorder";
import {
	copySlug,
	duplicateValues,
	emptyProject,
	rowToValues,
	slugify,
} from "@/lib/projectForm";
import { type ProjectRow, projectSchema } from "@/schemas/projects";

vi.mock("astro:env/client", () => ({
	PUBLIC_ICONS_URL: "https://icons.example.dev/api/icons",
}));
const {
	isValidTechName,
	KNOWN_TECHNOLOGIES,
	suggestTechnologies,
	techIconUrl,
} = await import("@/lib/techIcons");

const row = (over: Partial<ProjectRow> = {}): ProjectRow => ({
	project_id: 7,
	slug: "mi-proyecto",
	category: "frontend",
	status: "published",
	featured: true,
	sort_order: 3,
	card_image: "/UPVM.webp",
	gallery: ["projects/a.webp"],
	video_url: null,
	images_topics: ["react", "ts"],
	link_repo: "https://github.com/x/y",
	link_web: null,
	fork: false,
	title_default: "Mi proyecto",
	summary_default: "Resumen",
	description_default: "Descripción larga",
	translations: {
		en: { title: "My project", summary: null, description: "Long" },
		es: { title: "no" },
	},
	created_at: "2026-01-01 00:00:00",
	updated_at: "2026-02-01 00:00:00",
	...over,
});

describe("slugify", () => {
	it.each([
		["Mi proyecto: ¡nuevo!", "mi-proyecto-nuevo"],
		["  Canción de la Ñandú  ", "cancion-de-la-nandu"],
		["Rápido & Furioso 2", "rapido-furioso-2"],
		["---", ""],
		["", ""],
	])("%j -> %j", (input, expected) => {
		expect(slugify(input)).toBe(expected);
	});

	it("nunca pasa de 100 ni termina en guion, y siempre cumple el esquema", () => {
		const long = slugify(`${"a".repeat(99)} b c d`);
		expect(long.length).toBeLessThanOrEqual(100);
		expect(long.endsWith("-")).toBe(false);
		expect(projectSchema.shape.slug.safeParse(long).success).toBe(true);
	});
});

describe("copySlug", () => {
	it("agrega -copia y luego -copia-N", () => {
		expect(copySlug("mi-proyecto")).toBe("mi-proyecto-copia");
		expect(copySlug("mi-proyecto", 3)).toBe("mi-proyecto-copia-3");
	});
	it("respeta el tope de 100 caracteres", () => {
		const slug = "a".repeat(100);
		expect(copySlug(slug, 2).length).toBeLessThanOrEqual(100);
		expect(copySlug(slug, 2).endsWith("-copia-2")).toBe(true);
	});
});

describe("de la fila al formulario y de vuelta", () => {
	it("los nulos pasan a texto vacio y las traducciones se limpian", () => {
		const values = rowToValues(row());
		expect(values).toMatchObject({
			video_url: "",
			link_web: "",
			link_repo: "https://github.com/x/y",
		});
		// es no se traduce; los campos nulos se descartan.
		expect(values.translations).toEqual({
			en: { title: "My project", description: "Long" },
		});
	});

	it("el formulario relleno con una fila real pasa el esquema y deja la traduccion como lista", () => {
		const parsed = projectSchema.parse(rowToValues(row()));
		expect(parsed.video_url).toBeNull();
		expect(parsed.link_web).toBeNull();
		expect(parsed.translations).toEqual([
			{ locale: "en", title: "My project", description: "Long" },
		]);
		// Las claves heredadas con "/" inicial se conservan tal cual.
		expect(parsed.card_image).toBe("/UPVM.webp");
	});

	it("un proyecto nuevo nace como borrador y no pasa el esquema hasta tener datos", () => {
		const empty = emptyProject();
		expect(empty.status).toBe("draft");
		expect(projectSchema.safeParse(empty).success).toBe(false);
	});

	it("una copia es un borrador, no destacado, con otro slug", () => {
		const copy = duplicateValues(row());
		expect(copy).toMatchObject({
			slug: "mi-proyecto-copia",
			status: "draft",
			featured: false,
		});
		expect(projectSchema.safeParse(copy).success).toBe(true);
	});
});

describe("moveItem", () => {
	it("mueve sin mutar y respeta los bordes", () => {
		const list = ["a", "b", "c"];
		expect(moveItem(list, 0, 1)).toEqual(["b", "a", "c"]);
		expect(moveItem(list, 2, 1)).toEqual(["a", "c", "b"]);
		expect(moveItem(list, 0, -1)).toEqual(list);
		expect(moveItem(list, 2, 3)).toEqual(list);
		expect(list).toEqual(["a", "b", "c"]);
	});
});

describe("tecnologias", () => {
	it("la lista sale de los datos reales y no repite", () => {
		expect(KNOWN_TECHNOLOGIES).toContain("react");
		expect(new Set(KNOWN_TECHNOLOGIES).size).toBe(KNOWN_TECHNOLOGIES.length);
		for (const name of KNOWN_TECHNOLOGIES)
			expect(isValidTechName(name)).toBe(true);
	});

	it("un nombre valido es corto y sin mayusculas ni signos raros", () => {
		for (const ok of ["react", "c++", "node.js", "vue-3"])
			expect(isValidTechName(ok)).toBe(true);
		for (const bad of [
			"",
			"React",
			"con espacio",
			"a/b",
			"<img>",
			"x".repeat(41),
			"-x",
			"x?y=1",
		]) {
			expect(isValidTechName(bad)).toBe(false);
		}
	});

	it("la URL del icono codifica el nombre", () => {
		expect(techIconUrl("react")).toBe(
			"https://icons.example.dev/api/icons?i=react",
		);
		expect(techIconUrl("a&b")).toBe(
			"https://icons.example.dev/api/icons?i=a%26b",
		);
	});

	it("las sugerencias filtran, excluyen las elegidas y respetan el limite", () => {
		expect(suggestTechnologies("node", [])).toContain("nodejs");
		expect(suggestTechnologies("react", ["react"])).not.toContain("react");
		expect(suggestTechnologies("", [], 5)).toHaveLength(5);
		expect(suggestTechnologies("zzzz", [])).toEqual([]);
	});
});
