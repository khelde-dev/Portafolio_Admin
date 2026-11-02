import { FormSection } from "@/components/form/FormSection";
import { TextField } from "@/components/form/fields";
import { PeriodField } from "@/components/form/PeriodField";
import { ResourceForm } from "@/components/form/ResourceForm";
import { TranslationsTabs } from "@/components/form/TranslationsTabs";
import { ImagePickerField } from "@/components/media/ImagePicker";
import { api } from "@/lib/apiClient";
import { emptyExperience, experienceValues } from "@/lib/contentForms";
import {
	EXPERIENCE_TEXT_FIELDS,
	type ExperienceRow,
	experienceSchema,
} from "@/schemas/content";

const TRANSLATABLE = [
	{ name: "work", label: "Empresa", baseName: "work_default", required: false },
	{ name: "title", label: "Puesto", baseName: "title_default" },
	{
		name: "subtitle",
		label: "Descripción corta",
		baseName: "subtitle_default",
	},
	{ name: "location", label: "Ubicación", baseName: "location_default" },
] as const;

/** Crear o editar una experiencia laboral, con su logo y los tres idiomas. */
export const ExperienceForm = ({ initial }: { initial?: ExperienceRow }) => {
	const editing = Boolean(initial);
	return (
		<ResourceForm
			schema={experienceSchema}
			defaultValues={initial ? experienceValues(initial) : emptyExperience()}
			cancelHref="/experiencia"
			successMessage={editing ? "Guardado" : "Experiencia creada"}
			onSubmit={(payload) =>
				initial
					? api.put(`/api/experiences/${initial.experience_id}`, payload)
					: api.post("/api/experiences", payload)
			}
			onSaved={() => {
				if (!editing) window.location.assign("/experiencia");
			}}
		>
			<FormSection
				title="Logo"
				description="La imagen que acompaña esta experiencia. Siempre se guarda en WebP."
			>
				<ImagePickerField
					name="img"
					label="Logo o imagen"
					use="logo"
					required
				/>
				<TextField
					name="alt"
					label="Texto alternativo"
					required
					hint="Describe la imagen para quien no puede verla: «Logo de Acme». No repite el puesto."
				/>
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
								name="work_default"
								label="Empresa"
								hint={`Opcional. Hasta ${EXPERIENCE_TEXT_FIELDS.work} caracteres.`}
							/>
							<TextField name="title_default" label="Puesto" required />
							<TextField
								name="subtitle_default"
								label="Descripción corta"
								required
							/>
							<PeriodField />
							<TextField name="location_default" label="Ubicación" required />
						</>
					}
				/>
			</FormSection>
		</ResourceForm>
	);
};
