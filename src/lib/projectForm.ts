import { normalizeTranslations, type TranslationMap } from "@/lib/translations";
import { PROJECT_TEXT_FIELDS, type ProjectRow } from "@/schemas/projects";

/** Valores de un formulario de proyecto (`translations` como MAPA, listo para editar por idioma). */
export interface ProjectFormValues {
	slug: string;
	category: string;
	status: "draft" | "published";
	featured: boolean;
	sort_order: number;
	card_image: string;
	gallery: string[];
	video_url: string;
	images_topics: string[];
	link_repo: string;
	link_web: string;
	fork: boolean;
	title_default: string;
	summary_default: string;
	description_default: string;
	translations: TranslationMap;
}

const TEXT_FIELDS = Object.keys(PROJECT_TEXT_FIELDS);

/** Un proyecto nuevo: borrador por defecto, para que no salga en el sitio a medias. */
export const emptyProject = (): ProjectFormValues => ({
	slug: "",
	category: "",
	status: "draft",
	featured: false,
	sort_order: 0,
	card_image: "",
	gallery: [],
	video_url: "",
	images_topics: [],
	link_repo: "",
	link_web: "",
	fork: false,
	title_default: "",
	summary_default: "",
	description_default: "",
	translations: {},
});

/** Fila del backend -> valores del formulario (nulos pasan a texto vacio). */
export const rowToValues = (row: ProjectRow): ProjectFormValues => ({
	slug: row.slug,
	category: row.category,
	status: row.status,
	featured: Boolean(row.featured),
	sort_order: row.sort_order,
	card_image: row.card_image,
	gallery: [...(row.gallery ?? [])],
	video_url: row.video_url ?? "",
	images_topics: [...(row.images_topics ?? [])],
	link_repo: row.link_repo ?? "",
	link_web: row.link_web ?? "",
	fork: Boolean(row.fork),
	title_default: row.title_default,
	summary_default: row.summary_default,
	description_default: row.description_default,
	translations: normalizeTranslations(row.translations, TEXT_FIELDS),
});

/**
 * `Mi proyecto: ¡nuevo!` -> `mi-proyecto-nuevo`. Sin acentos ni signos; nunca
 * pasa de 100 caracteres (el tope del backend) y nunca empieza ni termina en `-`.
 */
export const slugify = (text: string): string =>
	text
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 100)
		.replace(/-+$/g, "");

/** Slug de una copia: `mi-proyecto-copia`, `mi-proyecto-copia-2`… dentro de los 100. */
export const copySlug = (slug: string, attempt = 1): string => {
	const suffix = attempt <= 1 ? "-copia" : `-copia-${attempt}`;
	return `${slug.slice(0, 100 - suffix.length).replace(/-+$/g, "")}${suffix}`;
};

/** Valores de una copia: mismos datos, estado borrador y destacado apagado. */
export const duplicateValues = (
	row: ProjectRow,
	attempt = 1,
): ProjectFormValues => ({
	...rowToValues(row),
	slug: copySlug(row.slug, attempt),
	status: "draft",
	featured: false,
});
