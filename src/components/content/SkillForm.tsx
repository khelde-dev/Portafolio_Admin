import { FormSection } from "@/components/form/FormSection";
import { TextField } from "@/components/form/fields";
import { ResourceForm } from "@/components/form/ResourceForm";
import { TechPicker } from "@/components/form/TechPicker";
import { TranslationsTabs } from "@/components/form/TranslationsTabs";
import { api } from "@/lib/apiClient";
import { emptySkill, skillValues } from "@/lib/contentForms";
import { type SkillRow, skillSchema } from "@/schemas/content";

const TRANSLATABLE = [
	{ name: "title", label: "Título del grupo", baseName: "title_default" },
] as const;

/** Crear o editar un grupo de habilidades ("Frontend", "Bases de datos"…) y sus tecnologías. */
export const SkillForm = ({ initial }: { initial?: SkillRow }) => {
	const editing = Boolean(initial);
	return (
		<ResourceForm
			schema={skillSchema}
			defaultValues={initial ? skillValues(initial) : emptySkill()}
			cancelHref="/habilidades"
			successMessage={editing ? "Guardado" : "Grupo creado"}
			onSubmit={(payload) =>
				initial
					? api.put(`/api/skills/${initial.skill_id}`, payload)
					: api.post("/api/skills", payload)
			}
			onSaved={() => {
				if (!editing) window.location.assign("/habilidades");
			}}
		>
			<FormSection
				title="Tecnologías"
				description="Los iconos que se ven en este grupo."
			>
				<TechPicker name="images_topics" label="Tecnologías" />
			</FormSection>

			<FormSection
				title="Título"
				description="El español es la base. Inglés y francés son opcionales."
			>
				<TranslationsTabs
					fields={TRANSLATABLE}
					spanish={
						<TextField name="title_default" label="Título del grupo" required />
					}
				/>
			</FormSection>
		</ResourceForm>
	);
};
