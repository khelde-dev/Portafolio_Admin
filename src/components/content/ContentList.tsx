import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { type Column, DataTable } from "@/components/DataTable";
import { MediaImage } from "@/components/media/MediaImage";
import {
	OrderBar,
	OrderIntro,
	OrderModeButton,
} from "@/components/OrderControls";
import { SortableList } from "@/components/SortableList";
import { EmptyState, ErrorState } from "@/components/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { useDeleteTarget } from "@/hooks/useDeleteTarget";
import { useReorder } from "@/hooks/useReorder";
import { useUrlParam } from "@/hooks/useUrlParams";
import { ApiFailure, api } from "@/lib/apiClient";
import { cn } from "@/lib/utils";

interface Props<T> {
	/** Segmento de `/api/<recurso>` (`experiences`, `education`, `skills`). */
	resource: string;
	initial: T[] | null;
	initialError?: string | null;
	getId: (row: T) => number;
	getTitle: (row: T) => string;
	/** Clave R2 de la miniatura, si la fila tiene imagen. */
	thumb?: (row: T) => string | null;
	/** Datos secundarios en mono (periodo, ubicacion, tecnologias…). */
	describe: (row: T) => string;
	searchText: (row: T) => string;
	editHref: (row: T) => string;
	newHref: string;
	/** Nombre en singular para los mensajes ("experiencia"). */
	noun: string;
	/** Nombre de la lista para lectores de pantalla. */
	label: string;
	emptyTitle: string;
	emptyDescription: string;
	deleteConsequence?: string;
}

/**
 * Lista de un modulo de contenido ordenable (experiencia, educacion,
 * habilidades): indice con filetes, orden con botones que se guarda de una vez
 * y borrado con confirmacion. Un solo componente para los tres modulos.
 */
export function ContentList<T>({
	resource,
	initial,
	initialError = null,
	getId,
	getTitle,
	thumb,
	describe,
	searchText,
	editHref,
	newHref,
	noun,
	label,
	emptyTitle,
	emptyDescription,
	deleteConsequence = "Se borra con sus textos en los tres idiomas. No se puede deshacer.",
}: Props<T>) {
	const order = useReorder<T>(initial ?? [], getId, resource);
	const { rows, replace } = order;
	// El modo ordenar vive en la URL (?orden=1).
	const [orderingRaw, setOrdering] = useUrlParam("orden", "");
	const ordering = orderingRaw === "1";
	const toggleOrdering = () => setOrdering(ordering ? "" : "1", { push: true });
	const [loadError, setLoadError] = useState<string | null>(initialError);
	const [notice, setNotice] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	// El modal de borrado vive en la URL (?borrar=<id>).
	const { deleting, requestDelete, cancelDelete } = useDeleteTarget(
		rows,
		getId,
	);

	const reload = useCallback(async () => {
		setLoadError(null);
		try {
			replace((await api.get<T[]>(`/api/${resource}`)) ?? []);
		} catch (error) {
			setLoadError(
				error instanceof ApiFailure ? error.message : "No se pudo cargar.",
			);
		}
	}, [replace, resource]);

	const remove = async () => {
		if (!deleting) return;
		setBusy(true);
		try {
			await api.delete(`/api/${resource}/${getId(deleting)}`);
			replace(rows.filter((r) => getId(r) !== getId(deleting)));
			cancelDelete();
		} catch (error) {
			cancelDelete();
			setNotice(
				error instanceof ApiFailure ? error.message : "No se pudo borrar.",
			);
		} finally {
			setBusy(false);
		}
	};

	if (loadError && rows.length === 0) {
		return (
			<ErrorState
				title={`No se pudo cargar: ${label.toLowerCase()}`}
				description={loadError}
				onRetry={reload}
			/>
		);
	}
	if (rows.length === 0) {
		return (
			<EmptyState title={emptyTitle} description={emptyDescription}>
				<a href={newHref} className={cn(buttonVariants(), "min-h-11 px-4")}>
					<Plus aria-hidden="true" /> Agregar {noun}
				</a>
			</EmptyState>
		);
	}

	const columns: Column<T>[] = [
		...(thumb
			? [
					{
						id: "image",
						header: "Imagen",
						hideHeader: true,
						className: "w-16",
						cell: (row: T) => {
							const image = thumb(row);
							return image ? (
								<MediaImage
									mediaKey={image}
									loading="lazy"
									className="size-14 rounded-lg border border-border bg-muted object-contain"
								/>
							) : null;
						},
					},
				]
			: []),
		{
			id: "name",
			header: "Nombre",
			className: "min-w-0 max-md:flex-1",
			cell: (row) => (
				<div className="min-w-0">
					<a
						href={editHref(row)}
						className="font-serif-display text-heading hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
					>
						{getTitle(row)}
					</a>
					<p className="eyebrow mt-1.5 break-words">{describe(row)}</p>
				</div>
			),
		},
		{
			id: "actions",
			header: "Acciones",
			hideHeader: true,
			className: "md:w-px md:whitespace-nowrap max-md:w-full",
			cell: (row) => {
				const title = getTitle(row);
				return (
					<div className="flex items-center gap-0.5">
						<a
							href={editHref(row)}
							className={cn(
								buttonVariants({ variant: "ghost", size: "icon" }),
								"size-11",
							)}
							aria-label={`Editar ${title}`}
						>
							<Pencil aria-hidden="true" />
						</a>
						<Button
							type="button"
							variant="ghost"
							size="icon"
							className="size-11 text-destructive"
							onClick={() => requestDelete(row)}
							aria-label={`Borrar ${title}`}
						>
							<Trash2 aria-hidden="true" />
						</Button>
					</div>
				);
			},
		},
	];

	return (
		<>
			{notice ? (
				<Alert variant="destructive" className="mb-5">
					<AlertDescription>{notice}</AlertDescription>
				</Alert>
			) : null}

			<OrderBar
				dirty={order.dirty}
				saving={order.saving}
				error={order.error}
				onSave={order.save}
				onDiscard={order.discard}
			/>

			{ordering ? (
				<>
					<OrderIntro
						count={rows.length}
						noun={label.toLowerCase()}
						active
						onToggle={toggleOrdering}
					/>
					<SortableList
						rows={rows}
						getId={getId}
						getTitle={getTitle}
						describe={describe}
						thumb={
							thumb
								? (row) => {
										const image = thumb(row);
										return image ? (
											<MediaImage
												mediaKey={image}
												loading="lazy"
												className="size-12 shrink-0 rounded-lg border border-border bg-muted object-contain"
											/>
										) : null;
									}
								: undefined
						}
						onMoveTo={order.moveTo}
						label={`Orden de ${label.toLowerCase()}`}
					/>
				</>
			) : (
				<DataTable
					rows={rows}
					getId={getId}
					label={label}
					searchLabel={`Buscar ${noun}`}
					searchText={searchText}
					filters={
						rows.length > 1 ? (
							<OrderModeButton active={false} onToggle={toggleOrdering} />
						) : undefined
					}
					empty={null}
					columns={columns}
				/>
			)}

			<ConfirmDelete
				open={deleting !== null}
				onOpenChange={(open) => !open && cancelDelete()}
				name={deleting ? getTitle(deleting) : ""}
				consequence={deleteConsequence}
				busy={busy}
				onConfirm={remove}
			/>
		</>
	);
}
