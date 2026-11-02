import { describe, expect, it } from "vitest";
import { r2Key, resourceId, slug } from "@/schemas/common";
import {
	aboutSchema,
	educationSchema,
	experienceSchema,
	orderSchema,
	skillSchema,
} from "@/schemas/content";
import {
	commentStatusSchema,
	messageQuerySchema,
	messageStatusSchema,
} from "@/schemas/inbox";
import { projectSchema } from "@/schemas/projects";

const project = {
	slug: "mi-proyecto",
	category: "frontend",
	card_image: "projects/abc.webp",
	title_default: "Mi proyecto",
	summary_default: "Resumen",
	description_default: "Descripción larga",
};

describe("slug", () => {
	it.each(["a", "mi-proyecto", "a1-b2"])("acepta %s", (v) => {
		expect(slug.safeParse(v).success).toBe(true);
	});
	it.each([
		"",
		"Mayus",
		"con espacio",
		"-a",
		"a-",
		"a--b",
		"ñandú",
		"../x",
		"a".repeat(101),
	])("rechaza %j", (v) => {
		expect(slug.safeParse(v).success).toBe(false);
	});
});

describe("r2Key", () => {
	it.each(["projects/abc.webp", "/UPVM.webp", "Backend_Task.webp"])(
		"acepta %s",
		(v) => {
			expect(r2Key().safeParse(v).success).toBe(true);
		},
	);
	it.each([
		"",
		"//evil.example/x",
		"https://x/y.webp",
		"a/../b.webp",
		"a\\b.webp",
		"a/./b",
		"a\u0000b",
		"x".repeat(513),
	])("rechaza %j", (v) => {
		expect(r2Key().safeParse(v).success).toBe(false);
	});
});

describe("resourceId", () => {
	it("acepta enteros positivos y los convierte", () => {
		expect(resourceId.parse("12")).toBe(12);
	});
	it.each(["", "0", "-1", "1e3", "0x10", " 1", "1 ", "abc", "1".repeat(16)])(
		"rechaza %j",
		(v) => {
			expect(resourceId.safeParse(v).success).toBe(false);
		},
	);
});

describe("projectSchema", () => {
	it("acepta el minimo y rellena los valores por defecto", () => {
		const out = projectSchema.parse(project);
		expect(out).toMatchObject({
			status: "published",
			featured: false,
			fork: false,
			sort_order: 0,
			gallery: [],
			images_topics: [],
			video_url: null,
			link_repo: null,
			link_web: null,
			translations: [],
		});
	});

	it("las URL vacias pasan a null y solo se aceptan http(s)", () => {
		expect(
			projectSchema.parse({ ...project, link_repo: "" }).link_repo,
		).toBeNull();
		for (const bad of [
			"javascript:alert(1)",
			"data:text/html,x",
			"ftp://x.dev",
			"no es url",
		]) {
			expect(
				projectSchema.safeParse({ ...project, link_web: bad }).success,
			).toBe(false);
		}
		expect(
			projectSchema.parse({ ...project, link_web: "https://khelde.dev" })
				.link_web,
		).toBe("https://khelde.dev");
	});

	it("convierte el mapa de traducciones del formulario a la lista del backend", () => {
		const out = projectSchema.parse({
			...project,
			translations: {
				en: { title: "Hi", summary: "", description: "Long" },
				fr: {},
			},
		});
		expect(out.translations).toEqual([
			{ locale: "en", title: "Hi", description: "Long" },
		]);
	});

	it("acepta la lista que ya manda el navegador y quita locales repetidos", () => {
		const out = projectSchema.parse({
			...project,
			translations: [
				{ locale: "en", title: "uno" },
				{ locale: "en", title: "dos" },
			],
		});
		expect(out.translations).toEqual([{ locale: "en", title: "dos" }]);
	});

	it("rechaza un idioma que no se traduce (es) y campos desconocidos no pasan al backend", () => {
		expect(
			projectSchema.safeParse({
				...project,
				translations: [{ locale: "es", title: "x" }],
			}).success,
		).toBe(false);
		const out = projectSchema.parse({ ...project, rol: "admin" }) as Record<
			string,
			unknown
		>;
		expect(out.rol).toBeUndefined();
	});

	it("limites: titulo 120, resumen 200, galeria 50, etiquetas sin repetir", () => {
		expect(
			projectSchema.safeParse({ ...project, title_default: "x".repeat(121) })
				.success,
		).toBe(false);
		expect(
			projectSchema.safeParse({ ...project, summary_default: "x".repeat(201) })
				.success,
		).toBe(false);
		expect(
			projectSchema.safeParse({ ...project, gallery: Array(51).fill("a.webp") })
				.success,
		).toBe(false);
		expect(
			projectSchema.safeParse({ ...project, images_topics: ["ts", "ts"] })
				.success,
		).toBe(false);
	});

	it("exige categoria valida y textos obligatorios con mensajes en espanol", () => {
		const res = projectSchema.safeParse({
			...project,
			category: "otra",
			title_default: " ",
		});
		expect(res.success).toBe(false);
		if (!res.success) {
			const messages = res.error.issues.map((i) => i.message).join("|");
			expect(messages).toContain("El título es obligatorio");
			expect(messages).toContain("Elige una categoría");
		}
	});

	it("el texto se recorta", () => {
		expect(
			projectSchema.parse({ ...project, title_default: "  Hola  " })
				.title_default,
		).toBe("Hola");
	});
});

describe("resto de esquemas de contenido", () => {
	it("experiencia: alt obligatorio y empresa vacia = null", () => {
		const base = {
			title_default: "Dev",
			subtitle_default: "Backend",
			img: "experience/a.webp",
			alt: "Logo de Acme",
			time_default: "2024",
			location_default: "CDMX",
		};
		expect(
			experienceSchema.parse({ ...base, work_default: "" }).work_default,
		).toBeNull();
		expect(experienceSchema.safeParse({ ...base, alt: "" }).success).toBe(
			false,
		);
		expect(
			experienceSchema.safeParse({ ...base, work_default: "x".repeat(101) })
				.success,
		).toBe(false);
	});

	it("educacion y habilidades", () => {
		expect(
			educationSchema.safeParse({
				institution_default: "UPVM",
				subtitle_default: "Ingeniería",
				description_default: "Texto",
				image: "education/u.webp",
				period_default: "2019 - 2023",
			}).success,
		).toBe(true);
		expect(
			skillSchema.safeParse({
				title_default: "Frontend",
				images_topics: ["react"],
			}).success,
		).toBe(true);
		expect(skillSchema.safeParse({ title_default: "" }).success).toBe(false);
	});

	it("sobre mi", () => {
		expect(
			aboutSchema.safeParse({
				image: "about/a.webp",
				title_card_default: "Hola",
				subtitle_default: "Soy",
				description_default: "Desarrollador",
			}).success,
		).toBe(true);
	});
});

describe("estados de la bandeja", () => {
	it("solo estados validos", () => {
		expect(commentStatusSchema.safeParse({ status: "hidden" }).success).toBe(
			true,
		);
		expect(commentStatusSchema.safeParse({ status: "borrado" }).success).toBe(
			false,
		);
		expect(messageStatusSchema.safeParse({ status: "replied" }).success).toBe(
			true,
		);
		expect(messageStatusSchema.safeParse({}).success).toBe(false);
	});

	it("el filtro es opcional pero estricto", () => {
		expect(messageQuerySchema.safeParse({}).success).toBe(true);
		expect(messageQuerySchema.safeParse({ status: "unread" }).success).toBe(
			true,
		);
		expect(messageQuerySchema.safeParse({ status: "x" }).success).toBe(false);
	});

	it("un comentario no acepta editar el texto de un visitante", () => {
		const out = commentStatusSchema.parse({
			status: "published",
			description: "hackeado",
		}) as Record<string, unknown>;
		expect(out.description).toBeUndefined();
	});
});

describe("orderSchema", () => {
	it("acepta una lista con ids unicos", () => {
		expect(
			orderSchema.safeParse([
				{ id: 1, sort_order: 0 },
				{ id: 2, sort_order: 1 },
			]).success,
		).toBe(true);
	});
	it("rechaza vacia, ids repetidos y valores raros", () => {
		expect(orderSchema.safeParse([]).success).toBe(false);
		expect(
			orderSchema.safeParse([
				{ id: 1, sort_order: 0 },
				{ id: 1, sort_order: 1 },
			]).success,
		).toBe(false);
		expect(orderSchema.safeParse([{ id: 0, sort_order: 0 }]).success).toBe(
			false,
		);
		expect(orderSchema.safeParse([{ id: 1, sort_order: -1 }]).success).toBe(
			false,
		);
		expect(orderSchema.safeParse([{ id: 1.5, sort_order: 0 }]).success).toBe(
			false,
		);
	});
});
