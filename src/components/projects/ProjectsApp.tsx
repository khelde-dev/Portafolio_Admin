import { Copy, ExternalLink, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useId, useMemo, useState } from "react";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { IndexList } from "@/components/IndexList";
import { LocalTime } from "@/components/LocalTime";
import { MediaImage } from "@/components/media/MediaImage";
import { MoveButtons, OrderBar } from "@/components/OrderControls";
import { StatusBadge } from "@/components/StatusBadge";
import { EmptyState, ErrorState } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { useReorder } from "@/hooks/useReorder";
import { ApiFailure, api } from "@/lib/apiClient";
import { duplicateValues } from "@/lib/projectForm";
import { cn } from "@/lib/utils";
import {
	CATEGORIES,
	CATEGORY_LABELS,
	PROJECT_STATUS_LABELS,
	type ProjectRow,
	projectSchema,
} from "@/schemas/projects";

interface Props {
	initial: ProjectRow[] | null;
	initialError?: string | null;
	/** URL del portafolio publico, para "Ver en el sitio". */
	siteUrl: string;
}

type Filter = "all" | "published" | "draft";

const getId = (row: ProjectRow) => row.project_id;

/**
 * Lista de proyectos: indice con miniatura, estado en palabras, orden con
 * botones (se guarda de una vez), duplicar y borrar con confirmacion. Con
 * decenas de proyectos se busca y filtra aqui, en el navegador.
 */
export const ProjectsApp = ({
	initial,
	initialError = null,
	siteUrl,
}: Props) => {
	const order = useReorder<ProjectRow>(initial ?? [], getId, "projects");
	const [loadError, setLoadError] = useState<string | null>(initialError);
	const [notice, setNotice] = useState<string | null>(null);
	const [filter, setFilter] = useState<Filter>("all");
	const [category, setCategory] = useState<string>("");
	const [deleting, setDeleting] = useState<ProjectRow | null>(null);
	const [busy, setBusy] = useState(false);
	const categoryId = useId();

	const { rows, replace } = order;

	const reload = useCallback(async () => {
		setLoadError(null);
		try {
			replace((await api.get<ProjectRow[]>("/api/projects")) ?? []);
		} catch (error) {
			setLoadError(
				error instanceof ApiFailure ? error.message : "No se pudo cargar.",
			);
		}
	}, [replace]);

	// El orden se edita sobre la lista completa; los filtros solo ocultan filas.
	const visible = useMemo(
		() =>
			rows.filter(
				(r) =>
					(filter === "all" || r.status === filter) &&
					(category === "" || r.category === category),
			),
		[rows, filter, category],
	);

	const remove = async () => {
		if (!deleting) return;
		setBusy(true);
		try {
			await api.delete(`/api/projects/${deleting.project_id}`);
			replace(rows.filter((r) => r.project_id !== deleting.project_id));
			setDeleting(null);
		} catch (error) {
			setDeleting(null);
			setNotice(
				error instanceof ApiFailure ? error.message : "No se pudo borrar.",
			);
		} finally {
			setBusy(false);
		}
	};

	const duplicate = async (row: ProjectRow) => {
		setNotice(null);
		// Una copia es un borrador con el slug `<slug>-copia`; si ya existe, `-copia-2`…
		for (let attempt = 1; attempt <= 6; attempt++) {
			const parsed = projectSchema.safeParse(duplicateValues(row, attempt));
			if (!parsed.success) {
				setNotice(
					"Este proyecto no se puede duplicar: tiene datos que ya no son válidos. Ábrelo y corrígelo.",
				);
				return;
			}
			try {
				await api.post("/api/projects", parsed.data);
				await reload();
				setNotice(null);
				return;
			} catch (error) {
				if (error instanceof ApiFailure && error.status === 409) continue;
				setNotice(
					error instanceof ApiFailure ? error.message : "No se pudo duplicar.",
				);
				return;
			}
		}
		setNotice(
			`Ya existen varias copias de «${row.title_default}». Borra alguna o cambia su slug.`,
		);
	};

	if (loadError && rows.length === 0) {
		return (
			<ErrorState
				title="No se pudieron cargar los proyectos"
				description={loadError}
				onRetry={reload}
			/>
		);
	}
	if (rows.length === 0) {
		return (
			<EmptyState
				title="Todavía no hay proyectos"
				description="Crea el primero: nace como borrador y no se ve en el sitio hasta que lo publiques."
			>
				<a
					href="/proyectos/nuevo"
					className={cn(buttonVariants(), "min-h-11 px-4")}
				>
					<Plus aria-hidden="true" /> Nuevo proyecto
				</a>
			</EmptyState>
		);
	}

	const filters = (
		<div className="flex flex-wrap items-center gap-2">
			<fieldset className="flex min-w-0 gap-1">
				<legend className="sr-only">Estado</legend>
				{(
					[
						["all", "Todos"],
						["published", "Publicados"],
						["draft", "Borradores"],
					] as const
				).map(([value, text]) => (
					<button
						key={value}
						type="button"
						aria-pressed={filter === value}
						onClick={() => setFilter(value)}
						className={cn(
							"min-h-11 rounded-md px-3 text-[0.9375rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
							filter === value
								? "bg-muted text-foreground"
								: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
						)}
					>
						{text}
					</button>
				))}
			</fieldset>
			<label className="sr-only" htmlFor={categoryId}>
				Categoría
			</label>
			<select
				id={categoryId}
				value={category}
				onChange={(event) => setCategory(event.target.value)}
				className="min-h-11 rounded-lg border border-input bg-background px-3 text-[0.9375rem]"
			>
				<option value="">Todas las categorías</option>
				{CATEGORIES.map((value) => (
					<option key={value} value={value}>
						{CATEGORY_LABELS[value]}
					</option>
				))}
			</select>
		</div>
	);

	return (
		<>
			{notice ? (
				<p
					role="alert"
					className="mb-5 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 font-medium text-destructive"
				>
					{notice}
				</p>
			) : null}

			<OrderBar
				dirty={order.dirty}
				saving={order.saving}
				error={order.error}
				onSave={order.save}
				onDiscard={order.discard}
			/>

			<IndexList
				rows={visible}
				getId={getId}
				label="Proyectos"
				searchLabel="Buscar proyecto"
				searchText={(r) =>
					`${r.title_default} ${r.slug} ${r.images_topics.join(" ")}`
				}
				filters={filters}
				empty={null}
				renderRow={(row) => {
					const index = rows.findIndex((r) => r.project_id === row.project_id);
					return (
						<div className="grid items-center gap-x-4 gap-y-3 px-1 py-4 md:grid-cols-[4.5rem_minmax(0,1fr)_auto]">
							<MediaImage
								mediaKey={row.card_image}
								loading="lazy"
								className="size-[4.5rem] rounded-lg border border-border bg-muted object-cover"
							/>
							<div className="min-w-0">
								<p className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
									<a
										href={`/proyectos/${row.project_id}`}
										className="font-serif-display text-heading hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
									>
										{row.title_default}
									</a>
									<StatusBadge
										tone={row.status === "published" ? "success" : "warning"}
									>
										{PROJECT_STATUS_LABELS[row.status]}
									</StatusBadge>
									{row.featured ? (
										<StatusBadge tone="primary">Destacado</StatusBadge>
									) : null}
								</p>
								<p className="eyebrow mt-1.5">
									/{row.slug}, {CATEGORY_LABELS[row.category]}, editado{" "}
									<LocalTime value={row.updated_at} />
								</p>
							</div>
							<div className="flex flex-wrap items-center gap-0.5">
								{filter === "all" && category === "" ? (
									<MoveButtons
										name={row.title_default}
										index={index}
										count={rows.length}
										onMove={(delta) => order.move(index, delta)}
									/>
								) : null}
								<a
									href={`/proyectos/${row.project_id}`}
									className={cn(
										buttonVariants({ variant: "ghost", size: "icon" }),
										"size-11",
									)}
									aria-label={`Editar ${row.title_default}`}
								>
									<Pencil aria-hidden="true" />
								</a>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="size-11"
									onClick={() => void duplicate(row)}
									aria-label={`Duplicar ${row.title_default}`}
								>
									<Copy aria-hidden="true" />
								</Button>
								{row.status === "published" ? (
									<a
										href={`${siteUrl.replace(/\/+$/, "")}/es/project/${encodeURIComponent(row.slug)}`}
										target="_blank"
										rel="noopener noreferrer"
										className={cn(
											buttonVariants({ variant: "ghost", size: "icon" }),
											"size-11",
										)}
										aria-label={`Ver ${row.title_default} en el sitio`}
									>
										<ExternalLink aria-hidden="true" />
									</a>
								) : null}
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="size-11 text-destructive"
									onClick={() => setDeleting(row)}
									aria-label={`Borrar ${row.title_default}`}
								>
									<Trash2 aria-hidden="true" />
								</Button>
							</div>
						</div>
					);
				}}
			/>
			{filter !== "all" || category !== "" ? (
				<p className="mt-3 text-sm text-muted-foreground">
					Para cambiar el orden, quita los filtros: el orden se edita sobre la
					lista completa.
				</p>
			) : null}

			<ConfirmDelete
				open={deleting !== null}
				onOpenChange={(open) => !open && setDeleting(null)}
				name={deleting?.title_default ?? ""}
				consequence="Se borra el proyecto y sus textos en los tres idiomas. Sus imágenes quedan en la biblioteca de medios. No se puede deshacer."
				busy={busy}
				onConfirm={remove}
			/>
		</>
	);
};
