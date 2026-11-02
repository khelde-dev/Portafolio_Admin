import { normalizeTranslations, type TranslationMap } from "@/lib/translations";
import {
	ABOUT_TEXT_FIELDS,
	type AboutRow,
	EDUCATION_TEXT_FIELDS,
	type EducationRow,
	EXPERIENCE_TEXT_FIELDS,
	type ExperienceRow,
	SKILL_TEXT_FIELDS,
	type SkillRow,
} from "@/schemas/content";

/**
 * Valores iniciales de los formularios de contenido. Los campos de texto nunca son
 * `null` (un <input> controlado no lo admite): lo ausente es "". El orden
 * (`sort_order`) se conserva de la fila; uno nuevo entra al final de la lista.
 */
export interface ExperienceValues {
	sort_order: number;
	work_default: string;
	title_default: string;
	subtitle_default: string;
	img: string;
	alt: string;
	time_default: string;
	location_default: string;
	translations: TranslationMap;
}

export const emptyExperience = (): ExperienceValues => ({
	sort_order: 0,
	work_default: "",
	title_default: "",
	subtitle_default: "",
	img: "",
	alt: "",
	time_default: "",
	location_default: "",
	translations: {},
});

export const experienceValues = (row: ExperienceRow): ExperienceValues => ({
	sort_order: row.sort_order,
	work_default: row.work_default ?? "",
	title_default: row.title_default,
	subtitle_default: row.subtitle_default,
	img: row.img,
	alt: row.alt,
	time_default: row.time_default,
	location_default: row.location_default,
	translations: normalizeTranslations(
		row.translations,
		Object.keys(EXPERIENCE_TEXT_FIELDS),
	),
});

export interface EducationValues {
	sort_order: number;
	institution_default: string;
	subtitle_default: string;
	description_default: string;
	image: string;
	period_default: string;
	translations: TranslationMap;
}

export const emptyEducation = (): EducationValues => ({
	sort_order: 0,
	institution_default: "",
	subtitle_default: "",
	description_default: "",
	image: "",
	period_default: "",
	translations: {},
});

export const educationValues = (row: EducationRow): EducationValues => ({
	sort_order: row.sort_order,
	institution_default: row.institution_default,
	subtitle_default: row.subtitle_default,
	description_default: row.description_default,
	image: row.image,
	period_default: row.period_default,
	translations: normalizeTranslations(
		row.translations,
		Object.keys(EDUCATION_TEXT_FIELDS),
	),
});

export interface SkillValues {
	sort_order: number;
	title_default: string;
	images_topics: string[];
	translations: TranslationMap;
}

export const emptySkill = (): SkillValues => ({
	sort_order: 0,
	title_default: "",
	images_topics: [],
	translations: {},
});

export const skillValues = (row: SkillRow): SkillValues => ({
	sort_order: row.sort_order,
	title_default: row.title_default,
	images_topics: [...(row.images_topics ?? [])],
	translations: normalizeTranslations(
		row.translations,
		Object.keys(SKILL_TEXT_FIELDS),
	),
});

export interface AboutValues {
	image: string;
	title_card_default: string;
	subtitle_default: string;
	description_default: string;
	translations: TranslationMap;
}

/** `about` es una sola fila y puede no existir todavia: entonces el formulario arranca vacio. */
export const aboutValues = (row: AboutRow | null | undefined): AboutValues => ({
	image: row?.image ?? "",
	title_card_default: row?.title_card_default ?? "",
	subtitle_default: row?.subtitle_default ?? "",
	description_default: row?.description_default ?? "",
	translations: normalizeTranslations(
		row?.translations,
		Object.keys(ABOUT_TEXT_FIELDS),
	),
});
