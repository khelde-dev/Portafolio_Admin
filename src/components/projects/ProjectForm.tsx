import { useEffect, useId, useRef } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { FormSection } from "@/components/form/FormSection";
import {
	SelectField,
	TextareaField,
	TextField,
	ToggleField,
} from "@/components/form/fields";
import { ResourceForm } from "@/components/form/ResourceForm";
import { TechPicker } from "@/components/form/TechPicker";
import { TranslationsTabs } from "@/components/form/TranslationsTabs";
import { GalleryField, ImagePickerField } from "@/components/media/ImagePicker";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { api } from "@/lib/apiClient";
import { emptyProject, rowToValues, slugify } from "@/lib/projectForm";
import {
	CATEGORIES,
	CATEGORY_LABELS,
	PROJECT_TEXT_FIELDS,
	type ProjectRow,
	projectSchema,
} from "@/schemas/projects";

/** Mientras el slug siga siendo el que sale del titulo, se va actualizando solo. */
const SlugSync = () => {
	const { control, getValues, setValue } = useFormContext();
	const title = useWatch({ control, name: "title_default" }) as string;
	const lastAuto = useRef("");

	useEffect(() => {
		const current = getValues("slug") as string;
		if (current === "" || current === lastAuto.current) {
			const next = slugify(title ?? "");
			lastAuto.current = next;
			setValue("slug", next, { shouldDirty: true });
		}
	}, [title, getValues, setValue]);
	return null;
};

/** Interruptor "Publicado": el estado real es `draft` | `published`. */
const PublishedToggle = () => {
	const { control } = useFormContext();
	const id = useId();
	const hintId = `${id}-hint`;
	return (
		<Controller
			control={control}
			name="status"
			render={({ field }) => (
				<div className="flex items-start justify-between gap-4">
					<div className="min-w-0">
						<Label htmlFor={id} className="text-[0.9375rem] font-medium">
							Publicado
						</Label>
						<p id={hintId} className="text-sm text-muted-foreground">
							Apagado es un borrador: no aparece en el sitio.
						</p>
					</div>
					<Switch
						id={id}
						checked={field.value === "published"}
						onCheckedChange={(on) => field.onChange(on ? "published" : "draft")}
						aria-describedby={hintId}
					/>
				</div>
			)}
		/>
	);
};

const TRANSLATABLE = [
	{ name: "title", label: "Título", baseName: "title_default" },
	{
		name: "summary",
		label: "Resumen",
		baseName: "summary_default",
		multiline: true,
		rows: 3,
	},
	{
		name: "description",
		label: "Descripción",
		baseName: "description_default",
		multiline: true,
		rows: 8,
	},
] as const;

interface Props {
	/** Sin esto se crea un proyecto nuevo. */
	initial?: ProjectRow;
}

/** Crear o editar un proyecto: datos, imagenes, enlaces, stack y textos en tres idiomas. */
export const ProjectForm = ({ initial }: Props) => {
	const editing = Boolean(initial);
	const defaults = initial ? rowToValues(initial) : emptyProject();

	return (
		<ResourceForm
			schema={projectSchema}
			defaultValues={defaults}
			cancelHref="/proyectos"
			successMessage={editing ? "Guardado" : "Proyecto creado"}
			onSubmit={(payload) =>
				initial
					? api.put(`/api/projects/${initial.project_id}`, payload)
					: api.post("/api/projects", payload)
			}
			onSaved={() => {
				if (!editing) window.location.assign("/proyectos");
			}}
		>
			{editing ? null : <SlugSync />}

			<FormSection
				title="Datos"
				description="Cómo se identifica y dónde aparece en el sitio."
			>
				<PublishedToggle />
				<SelectField
					name="category"
					label="Categoría"
					required
					options={CATEGORIES.map((value) => ({
						value,
						label: CATEGORY_LABELS[value],
					}))}
				/>
				<TextField
					name="slug"
					label="Slug"
					required
					hint="La parte final de la dirección: /proyecto/mi-proyecto. Solo minúsculas, números y guiones."
				/>
				<ToggleField
					name="featured"
					label="Destacado"
					hint="Aparece en la franja de destacados de la portada y primero dentro de su categoría. Apágalo y vuelve al orden normal."
				/>
				<ToggleField
					name="fork"
					label="Es un fork"
					hint="Se marca con una etiqueta de fork en la tarjeta."
				/>
			</FormSection>

			<FormSection title="Imágenes" description="Siempre se guardan en WebP.">
				<ImagePickerField
					name="card_image"
					label="Imagen de la tarjeta"
					use="card"
					required
				/>
				<GalleryField
					name="gallery"
					label="Galería"
					use="gallery"
					hint="Fotos extra del proyecto: se ven como carrusel en su página, después de la imagen de la tarjeta, en este orden."
				/>
			</FormSection>

			<FormSection title="Enlaces" description="Todos son opcionales.">
				<TextField
					name="link_repo"
					label="Repositorio"
					type="url"
					inputMode="url"
					placeholder="https://github.com/…"
				/>
				<TextField
					name="link_web"
					label="Sitio en vivo"
					type="url"
					inputMode="url"
					placeholder="https://…"
				/>
				<TextField
					name="video_url"
					label="Video"
					type="url"
					inputMode="url"
					placeholder="https://…"
				/>
			</FormSection>

			<FormSection
				title="Tecnologías"
				description="Los iconos que se ven en la tarjeta."
			>
				<TechPicker name="images_topics" label="Tecnologías" />
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
								name="title_default"
								label="Título"
								required
								hint={`Hasta ${PROJECT_TEXT_FIELDS.title} caracteres.`}
							/>
							<TextareaField
								name="summary_default"
								label="Resumen"
								required
								rows={3}
								hint={`Lo que se lee en la tarjeta. Hasta ${PROJECT_TEXT_FIELDS.summary} caracteres.`}
							/>
							<TextareaField
								name="description_default"
								label="Descripción"
								required
								rows={9}
								hint='El texto largo de "Sobre el proyecto".'
							/>
						</>
					}
				/>
			</FormSection>
		</ResourceForm>
	);
};
