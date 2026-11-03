import { z } from "zod";
import {
	r2Key,
	requiredText,
	sortOrder,
	topics,
	translationsField,
} from "@/schemas/common";

/** Experiencia laboral (`experience`). */
export const EXPERIENCE_TEXT_FIELDS = {
	work: 100,
	title: 200,
	subtitle: 400,
	time: 100,
	location: 150,
} as const;

export const experienceSchema = z.object({
	sort_order: sortOrder,
	work_default: z
		.string()
		.trim()
		.max(100, "La empresa admite hasta 100 caracteres")
		.nullish()
		.transform((v) => (v ? v : null)),
	title_default: requiredText("El título", EXPERIENCE_TEXT_FIELDS.title),
	subtitle_default: requiredText(
		"El subtítulo",
		EXPERIENCE_TEXT_FIELDS.subtitle,
	),
	img: r2Key("La imagen"),
	alt: requiredText("El texto alternativo", 160),
	time_default: requiredText("El periodo", EXPERIENCE_TEXT_FIELDS.time),
	location_default: requiredText(
		"La ubicación",
		EXPERIENCE_TEXT_FIELDS.location,
	),
	translations: translationsField(EXPERIENCE_TEXT_FIELDS),
});
export type ExperienceInput = z.input<typeof experienceSchema>;

export interface ExperienceRow {
	experience_id: number;
	sort_order: number;
	work_default: string | null;
	title_default: string;
	subtitle_default: string;
	img: string;
	alt: string;
	time_default: string;
	location_default: string;
	translations: Record<string, Record<string, string | null>>;
	created_at: string;
	updated_at: string;
}

/** Educacion (`education`). */
export const EDUCATION_TEXT_FIELDS = {
	institution: 150,
	subtitle: 400,
	description: 3000,
	period: 100,
} as const;

export const educationSchema = z.object({
	sort_order: sortOrder,
	institution_default: requiredText(
		"La institución",
		EDUCATION_TEXT_FIELDS.institution,
	),
	subtitle_default: requiredText(
		"El subtítulo",
		EDUCATION_TEXT_FIELDS.subtitle,
	),
	description_default: requiredText(
		"La descripción",
		EDUCATION_TEXT_FIELDS.description,
	),
	image: r2Key("El logo"),
	period_default: requiredText("El periodo", EDUCATION_TEXT_FIELDS.period),
	translations: translationsField(EDUCATION_TEXT_FIELDS),
});
export type EducationInput = z.input<typeof educationSchema>;

export interface EducationRow {
	education_id: number;
	sort_order: number;
	institution_default: string;
	subtitle_default: string;
	description_default: string;
	image: string;
	period_default: string;
	translations: Record<string, Record<string, string | null>>;
	created_at: string;
	updated_at: string;
}

/** Habilidades (`skills`): un grupo con sus tecnologias. */
export const SKILL_TEXT_FIELDS = { title: 100 } as const;

export const skillSchema = z.object({
	sort_order: sortOrder,
	title_default: requiredText("El título", SKILL_TEXT_FIELDS.title),
	images_topics: topics,
	translations: translationsField(SKILL_TEXT_FIELDS),
});
export type SkillInput = z.input<typeof skillSchema>;

export interface SkillRow {
	skill_id: number;
	sort_order: number;
	title_default: string;
	images_topics: string[];
	translations: Record<string, Record<string, string | null>>;
	created_at: string;
	updated_at: string;
}

/** Sobre mi (`about`, singleton con id = 1). */
export const ABOUT_TEXT_FIELDS = {
	title_card: 200,
	subtitle: 400,
	description: 5000,
} as const;

export const aboutSchema = z.object({
	image: r2Key("La imagen"),
	title_card_default: requiredText(
		"El título de la tarjeta",
		ABOUT_TEXT_FIELDS.title_card,
	),
	subtitle_default: requiredText("El subtítulo", ABOUT_TEXT_FIELDS.subtitle),
	description_default: requiredText(
		"La descripción",
		ABOUT_TEXT_FIELDS.description,
	),
	translations: translationsField(ABOUT_TEXT_FIELDS),
});
export type AboutInput = z.input<typeof aboutSchema>;

export interface AboutRow {
	about_id: number;
	image: string;
	title_card_default: string;
	subtitle_default: string;
	description_default: string;
	translations: Record<string, Record<string, string | null>>;
	created_at: string;
	updated_at: string;
}

/** Orden en lote: `[{ id, sort_order }]`. */
export const orderSchema = z
	.array(
		z.object({
			id: z.number().int().positive(),
			sort_order: z.number().int().min(0).max(100000),
		}),
	)
	.min(1, "No hay nada que ordenar")
	.max(200, "Demasiados elementos")
	.refine(
		(list) => new Set(list.map((i) => i.id)).size === list.length,
		"Hay ids repetidos",
	);
