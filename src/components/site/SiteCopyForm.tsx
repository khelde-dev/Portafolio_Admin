import { FormSection } from "@/components/form/FormSection";
import { TextareaField, TextField } from "@/components/form/fields";
import { ResourceForm } from "@/components/form/ResourceForm";
import { TranslationsTabs } from "@/components/form/TranslationsTabs";
import { ImagePickerField } from "@/components/media/ImagePicker";
import { api } from "@/lib/apiClient";
import { siteCopyValues } from "@/lib/contentForms";
import {
	SITE_COPY_FIELDS,
	type SiteCopyRow,
	siteCopySchema,
} from "@/schemas/siteCopy";

const TRANSLATABLE = [
	{
		name: "hero_image_alt",
		label: "Texto alternativo de la foto",
		baseName: "hero_image_alt_default",
	},
	{
		name: "hero_label",
		label: "Etiqueta del hero",
		baseName: "hero_label_default",
	},
	{
		name: "hero_lead",
		label: "Presentación del hero",
		baseName: "hero_lead_default",
		multiline: true,
		rows: 4,
	},
	{
		name: "manifesto_text",
		label: "Frase del manifiesto",
		baseName: "manifesto_text_default",
		multiline: true,
		rows: 4,
	},
	{
		name: "meta_description",
		label: "Descripción para buscadores",
		baseName: "meta_description_default",
		multiline: true,
		rows: 3,
	},
] as const;

/**
 * Textos del sitio y la foto del hero: UNA sola ficha, no se crea ni se borra. La
 * foto se sube o se elige de la biblioteca y se puede reemplazar cuando quieras.
 */
export const SiteCopyForm = ({ initial }: { initial: SiteCopyRow | null }) => (
	<ResourceForm
		schema={siteCopySchema}
		defaultValues={siteCopyValues(initial)}
		successMessage="Guardado"
		onSubmit={(payload) => api.put("/api/site-copy", payload)}
	>
		<FormSection
			title="Foto del hero"
			description="El retrato de la portada. Siempre se guarda en WebP; al reemplazarla, la anterior queda en la biblioteca de medios."
		>
			<ImagePickerField name="hero_image" label="Foto" use="site" required />
		</FormSection>

		<FormSection
			title="Textos"
			description="El español es la base. Inglés y francés son opcionales: lo que dejes vacío se muestra en español."
		>
			<TranslationsTabs
				fields={TRANSLATABLE}
				spanish={
					<>
						<TextField
							name="hero_image_alt_default"
							label="Texto alternativo de la foto"
							required
							hint={`Describe la foto para quien no puede verla. Hasta ${SITE_COPY_FIELDS.hero_image_alt} caracteres.`}
						/>
						<TextField
							name="hero_label_default"
							label="Etiqueta del hero"
							required
							hint="La línea corta sobre tu nombre, por ejemplo tu puesto."
						/>
						<TextareaField
							name="hero_lead_default"
							label="Presentación del hero"
							required
							rows={4}
						/>
						<TextareaField
							name="manifesto_text_default"
							label="Frase del manifiesto"
							required
							rows={4}
							hint="La frase grande que se ilumina al hacer scroll."
						/>
						<TextareaField
							name="meta_description_default"
							label="Descripción para buscadores"
							required
							rows={3}
							hint={`Lo que ven Google y las redes al compartir el sitio. Hasta ${SITE_COPY_FIELDS.meta_description} caracteres.`}
						/>
					</>
				}
			/>
		</FormSection>
	</ResourceForm>
);
