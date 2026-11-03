import { emptyPeriod, type PeriodValue, parsePeriod } from "@/lib/period";
import { normalizeTranslations, type TranslationMap } from "@/lib/translations";
import type { ContactRow } from "@/schemas/contact";
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
import { SITE_COPY_FIELDS, type SiteCopyRow } from "@/schemas/siteCopy";

/**
 * Valores iniciales de los formularios de contenido. Los campos de texto nunca son
 * `null` (un <input> controlado no lo admite): lo ausente es "". El orden
 * (`sort_order`) se conserva de la fila; uno nuevo entra al final de la lista.
 */
/** El `updated_at` leido (solo al editar): se manda de vuelta para detectar otra edicion. */
interface WithVersion {
	updated_at?: string;
}

export interface ExperienceValues extends WithVersion {
	sort_order: number;
	work_default: string;
	title_default: string;
	subtitle_default: string;
	img: string;
	alt: string;
	time_default: string;
	/** Solo del formulario (mes y año); lo que viaja es `time_default`. */
	period: PeriodValue;
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
	period: emptyPeriod(),
	location_default: "",
	translations: {},
});

export const experienceValues = (row: ExperienceRow): ExperienceValues => ({
	updated_at: row.updated_at,
	sort_order: row.sort_order,
	work_default: row.work_default ?? "",
	title_default: row.title_default,
	subtitle_default: row.subtitle_default,
	img: row.img,
	alt: row.alt,
	time_default: row.time_default,
	period: parsePeriod(row.time_default) ?? emptyPeriod(),
	location_default: row.location_default,
	translations: normalizeTranslations(
		row.translations,
		Object.keys(EXPERIENCE_TEXT_FIELDS),
	),
});

export interface EducationValues extends WithVersion {
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
	updated_at: row.updated_at,
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

export interface SkillValues extends WithVersion {
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
	updated_at: row.updated_at,
	sort_order: row.sort_order,
	title_default: row.title_default,
	images_topics: [...(row.images_topics ?? [])],
	translations: normalizeTranslations(
		row.translations,
		Object.keys(SKILL_TEXT_FIELDS),
	),
});

export interface AboutValues extends WithVersion {
	image: string;
	title_card_default: string;
	subtitle_default: string;
	description_default: string;
	translations: TranslationMap;
}

/** `about` es una sola fila y puede no existir todavia: entonces el formulario arranca vacio. */
export const aboutValues = (row: AboutRow | null | undefined): AboutValues => ({
	...(row ? { updated_at: row.updated_at } : {}),
	image: row?.image ?? "",
	title_card_default: row?.title_card_default ?? "",
	subtitle_default: row?.subtitle_default ?? "",
	description_default: row?.description_default ?? "",
	translations: normalizeTranslations(
		row?.translations,
		Object.keys(ABOUT_TEXT_FIELDS),
	),
});

export interface ContactValues extends WithVersion {
	github_url: string;
	linkedin_url: string;
	linkedin_name: string;
	phone: string;
	email: string;
}

/** Los datos de contacto son una sola fila y puede no existir: entonces arranca vacio. */
export const contactValues = (
	row: ContactRow | null | undefined,
): ContactValues => ({
	...(row ? { updated_at: row.updated_at } : {}),
	github_url: row?.github_url ?? "",
	linkedin_url: row?.linkedin_url ?? "",
	linkedin_name: row?.linkedin_name ?? "",
	phone: row?.phone ?? "",
	email: row?.email ?? "",
});

export interface SiteCopyValues extends WithVersion {
	hero_image: string;
	hero_image_alt_default: string;
	hero_label_default: string;
	hero_lead_default: string;
	manifesto_text_default: string;
	meta_description_default: string;
	translations: TranslationMap;
}

/** Los textos del sitio son una sola ficha y puede no existir: entonces el formulario arranca vacio. */
export const siteCopyValues = (
	row: SiteCopyRow | null | undefined,
): SiteCopyValues => ({
	...(row ? { updated_at: row.updated_at } : {}),
	hero_image: row?.hero_image ?? "",
	hero_image_alt_default: row?.hero_image_alt_default ?? "",
	hero_label_default: row?.hero_label_default ?? "",
	hero_lead_default: row?.hero_lead_default ?? "",
	manifesto_text_default: row?.manifesto_text_default ?? "",
	meta_description_default: row?.meta_description_default ?? "",
	translations: normalizeTranslations(
		row?.translations,
		Object.keys(SITE_COPY_FIELDS),
	),
});
