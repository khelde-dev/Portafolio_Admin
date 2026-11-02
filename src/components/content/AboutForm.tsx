import { FormSection } from "@/components/form/FormSection";
import { TextareaField, TextField } from "@/components/form/fields";
import { ResourceForm } from "@/components/form/ResourceForm";
import { TranslationsTabs } from "@/components/form/TranslationsTabs";
import { ImagePickerField } from "@/components/media/ImagePicker";
import { api } from "@/lib/apiClient";
import { aboutValues } from "@/lib/contentForms";
import { type AboutRow, aboutSchema } from "@/schemas/content";

const TRANSLATABLE = [
	{
		name: "title_card",
		label: "Título de la tarjeta",
		baseName: "title_card_default",
	},
	{ name: "subtitle", label: "Subtítulo", baseName: "subtitle_default" },
	{
		name: "description",
		label: "Descripción",
		baseName: "description_default",
		multiline: true,
		rows: 8,
	},
] as const;

/**
 * "Sobre mí" es UNA sola fila: no se crea ni se borra, solo se edita. Si todavia
 * no existe, guardar la crea (el backend hace un upsert).
 */
export const AboutForm = ({ initial }: { initial: AboutRow | null }) => (
	<ResourceForm
		schema={aboutSchema}
		defaultValues={aboutValues(initial)}
		successMessage="Guardado"
		onSubmit={(payload) => api.put("/api/about", payload)}
	>
		<FormSection
			title="Imagen"
			description="El retrato de la sección. Siempre se guarda en WebP."
		>
			<ImagePickerField name="image" label="Retrato" use="about" required />
		</FormSection>

		<FormSection
			title="Textos"
			description="El español es la base. Inglés y francés son opcionales."
		>
			<TranslationsTabs
				fields={TRANSLATABLE}
				spanish={
					<>
						<TextField
							name="title_card_default"
							label="Título de la tarjeta"
							required
						/>
						<TextField name="subtitle_default" label="Subtítulo" required />
						<TextareaField
							name="description_default"
							label="Descripción"
							required
							rows={9}
						/>
					</>
				}
			/>
		</FormSection>
	</ResourceForm>
);
