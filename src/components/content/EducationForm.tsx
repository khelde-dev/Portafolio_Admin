import { FormSection } from "@/components/form/FormSection";
import { TextareaField, TextField } from "@/components/form/fields";
import { ResourceForm } from "@/components/form/ResourceForm";
import { TranslationsTabs } from "@/components/form/TranslationsTabs";
import { ImagePickerField } from "@/components/media/ImagePicker";
import { api } from "@/lib/apiClient";
import { educationValues, emptyEducation } from "@/lib/contentForms";
import { type EducationRow, educationSchema } from "@/schemas/content";

const TRANSLATABLE = [
	{
		name: "institution",
		label: "Institución",
		baseName: "institution_default",
	},
	{ name: "subtitle", label: "Carrera o curso", baseName: "subtitle_default" },
	{
		name: "description",
		label: "Descripción",
		baseName: "description_default",
		multiline: true,
		rows: 5,
	},
	{ name: "period", label: "Periodo", baseName: "period_default" },
] as const;

/** Crear o editar una entrada de educación, con el logo de la institución. */
export const EducationForm = ({ initial }: { initial?: EducationRow }) => {
	const editing = Boolean(initial);
	return (
		<ResourceForm
			schema={educationSchema}
			defaultValues={initial ? educationValues(initial) : emptyEducation()}
			cancelHref="/educacion"
			successMessage={editing ? "Guardado" : "Educación creada"}
			onSubmit={(payload) =>
				initial
					? api.put(`/api/education/${initial.education_id}`, payload)
					: api.post("/api/education", payload)
			}
			onSaved={() => {
				if (!editing) window.location.assign("/educacion");
			}}
		>
			<FormSection
				title="Logo"
				description="El logo de la institución. Siempre se guarda en WebP."
			>
				<ImagePickerField name="image" label="Logo" use="school" required />
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
								name="institution_default"
								label="Institución"
								required
							/>
							<TextField
								name="subtitle_default"
								label="Carrera o curso"
								required
							/>
							<TextareaField
								name="description_default"
								label="Descripción"
								required
								rows={5}
							/>
							<TextField
								name="period_default"
								label="Periodo"
								required
								hint="Por ejemplo: 2019 - 2023."
							/>
						</>
					}
				/>
			</FormSection>
		</ResourceForm>
	);
};
