import { z } from "zod";
import { r2Key, requiredText, translationsField } from "@/schemas/common";

/**
 * Textos del sitio que son contenido y no interfaz (`site_copy`, una sola fila con
 * id = 1): la foto del hero y su texto alternativo, la etiqueta y la presentacion
 * del hero, la frase del manifiesto y la descripcion para buscadores. Mismos limites
 * que el backend.
 */
export const SITE_COPY_FIELDS = {
	hero_image_alt: 160,
	hero_label: 100,
	hero_lead: 500,
	manifesto_text: 500,
	meta_description: 300,
} as const;

export const siteCopySchema = z.object({
	// El `updated_at` que leyo el formulario: el backend responde 409 si la fila ya cambio.
	updated_at: z.string().max(40).optional(),
	hero_image: r2Key("La foto del hero"),
	hero_image_alt_default: requiredText(
		"El texto alternativo de la foto",
		SITE_COPY_FIELDS.hero_image_alt,
	),
	hero_label_default: requiredText(
		"La etiqueta del hero",
		SITE_COPY_FIELDS.hero_label,
	),
	hero_lead_default: requiredText(
		"La presentación del hero",
		SITE_COPY_FIELDS.hero_lead,
	),
	manifesto_text_default: requiredText(
		"La frase del manifiesto",
		SITE_COPY_FIELDS.manifesto_text,
	),
	meta_description_default: requiredText(
		"La descripción del sitio",
		SITE_COPY_FIELDS.meta_description,
	),
	translations: translationsField(SITE_COPY_FIELDS),
});
export type SiteCopyInput = z.input<typeof siteCopySchema>;

export interface SiteCopyRow {
	site_copy_id: number;
	hero_image: string;
	hero_image_alt_default: string;
	hero_label_default: string;
	hero_lead_default: string;
	manifesto_text_default: string;
	meta_description_default: string;
	/** Clave en R2 del PDF del curriculum; se sube por separado (`/api/cv`). */
	cv_pdf_key: string | null;
	translations: Record<string, Record<string, string | null>>;
	created_at: string;
	updated_at: string;
}
