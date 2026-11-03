import { z } from "zod";
import {
	optionalUrl,
	r2Key,
	requiredText,
	slug,
	sortOrder,
	topics,
	translationsField,
} from "@/schemas/common";

export const CATEGORIES = [
	"frontend",
	"backend",
	"companies",
	"dataAnalyst",
] as const;
export type Category = (typeof CATEGORIES)[number];
export const CATEGORY_LABELS: Record<Category, string> = {
	frontend: "Frontend",
	backend: "Backend",
	companies: "Empresas",
	dataAnalyst: "Análisis de datos",
};

export const PROJECT_STATUSES = ["draft", "published"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
	draft: "Borrador",
	published: "Publicado",
};

/** Campos traducibles y su tope (el titulo y el resumen son los de la tarjeta). */
export const PROJECT_TEXT_FIELDS = {
	title: 120,
	summary: 200,
	description: 5000,
} as const;

export const projectSchema = z.object({
	// El `updated_at` que leyo el formulario: el backend responde 409 si la fila ya cambio.
	updated_at: z.string().max(40).optional(),
	slug,
	category: z.enum(CATEGORIES, { error: "Elige una categoría" }),
	status: z.enum(PROJECT_STATUSES).default("published"),
	featured: z.boolean().default(false),
	sort_order: sortOrder,
	card_image: r2Key("La imagen de la tarjeta"),
	gallery: z
		.array(r2Key())
		.max(50, "La galería admite hasta 50 imágenes")
		.default([]),
	video_url: optionalUrl,
	images_topics: topics,
	link_repo: optionalUrl,
	link_web: optionalUrl,
	fork: z.boolean().default(false),
	title_default: requiredText("El título", PROJECT_TEXT_FIELDS.title),
	summary_default: requiredText("El resumen", PROJECT_TEXT_FIELDS.summary),
	description_default: requiredText(
		"La descripción",
		PROJECT_TEXT_FIELDS.description,
	),
	translations: translationsField(PROJECT_TEXT_FIELDS),
});

export type ProjectInput = z.input<typeof projectSchema>;
export type ProjectPayload = z.output<typeof projectSchema>;

/** Fila que entrega `GET /projects/admin`. */
export interface ProjectRow {
	project_id: number;
	slug: string;
	category: Category;
	status: ProjectStatus;
	featured: boolean;
	sort_order: number;
	card_image: string;
	gallery: string[];
	video_url: string | null;
	images_topics: string[];
	link_repo: string | null;
	link_web: string | null;
	fork: boolean;
	title_default: string;
	summary_default: string;
	description_default: string;
	translations: Record<string, Record<string, string | null>>;
	created_at: string;
	updated_at: string;
}
