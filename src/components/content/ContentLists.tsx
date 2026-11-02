import { ContentList } from "@/components/content/ContentList";
import type { EducationRow, ExperienceRow, SkillRow } from "@/schemas/content";

/**
 * Las tres listas ordenables. Son islas SIN funciones en sus props (Astro solo
 * pasa datos serializables a una isla): cada una define aqui como se lee su fila.
 */
interface ListProps<T> {
	initial: T[] | null;
	initialError?: string | null;
}

export const ExperienceList = ({
	initial,
	initialError,
}: ListProps<ExperienceRow>) => (
	<ContentList<ExperienceRow>
		resource="experiences"
		initial={initial}
		initialError={initialError}
		getId={(r) => r.experience_id}
		getTitle={(r) => r.title_default}
		thumb={(r) => r.img}
		describe={(r) =>
			[r.work_default, r.time_default, r.location_default]
				.filter(Boolean)
				.join(", ")
		}
		searchText={(r) =>
			`${r.title_default} ${r.work_default ?? ""} ${r.location_default}`
		}
		editHref={(r) => `/experiencia/${r.experience_id}`}
		newHref="/experiencia/nuevo"
		noun="experiencia"
		label="Experiencia"
		emptyTitle="Todavía no hay experiencia"
		emptyDescription="Agrega tu primer trabajo: aparecerá en la sección de experiencia del sitio."
	/>
);

export const EducationList = ({
	initial,
	initialError,
}: ListProps<EducationRow>) => (
	<ContentList<EducationRow>
		resource="education"
		initial={initial}
		initialError={initialError}
		getId={(r) => r.education_id}
		getTitle={(r) => r.institution_default}
		thumb={(r) => r.image}
		describe={(r) =>
			[r.subtitle_default, r.period_default].filter(Boolean).join(", ")
		}
		searchText={(r) => `${r.institution_default} ${r.subtitle_default}`}
		editHref={(r) => `/educacion/${r.education_id}`}
		newHref="/educacion/nuevo"
		noun="estudio"
		label="Educación"
		emptyTitle="Todavía no hay estudios"
		emptyDescription="Agrega tu primera institución: aparecerá en la sección de educación del sitio."
	/>
);

export const SkillsList = ({ initial, initialError }: ListProps<SkillRow>) => (
	<ContentList<SkillRow>
		resource="skills"
		initial={initial}
		initialError={initialError}
		getId={(r) => r.skill_id}
		getTitle={(r) => r.title_default}
		describe={(r) =>
			r.images_topics.length > 0
				? r.images_topics.join(", ")
				: "Sin tecnologías"
		}
		searchText={(r) => `${r.title_default} ${r.images_topics.join(" ")}`}
		editHref={(r) => `/habilidades/${r.skill_id}`}
		newHref="/habilidades/nuevo"
		noun="grupo"
		label="Habilidades"
		emptyTitle="Todavía no hay grupos de habilidades"
		emptyDescription="Crea un grupo (por ejemplo «Frontend») y elige sus tecnologías."
		deleteConsequence="Se borra el grupo con sus textos en los tres idiomas. Las tecnologías no se borran de ningún otro lugar. No se puede deshacer."
	/>
);
