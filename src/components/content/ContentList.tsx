import { Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { IndexList } from "@/components/IndexList";
import { MediaImage } from "@/components/media/MediaImage";
import { MoveButtons, OrderBar } from "@/components/OrderControls";
import { EmptyState, ErrorState } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { useReorder } from "@/hooks/useReorder";
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
	const [loadError, setLoadError] = useState<string | null>(initialError);
	const [notice, setNotice] = useState<string | null>(null);
	const [deleting, setDeleting] = useState<T | null>(null);
	const [busy, setBusy] = useState(false);

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
				rows={rows}
				getId={getId}
				label={label}
				searchLabel={`Buscar ${noun}`}
				searchText={searchText}
				empty={null}
				renderRow={(row) => {
					const index = rows.findIndex((r) => getId(r) === getId(row));
					const image = thumb?.(row);
					const title = getTitle(row);
					return (
						<div
							className={cn(
								"grid items-center gap-x-4 gap-y-3 px-1 py-4",
								image
									? "md:grid-cols-[3.5rem_minmax(0,1fr)_auto]"
									: "md:grid-cols-[minmax(0,1fr)_auto]",
							)}
						>
							{image ? (
								<MediaImage
									mediaKey={image}
									loading="lazy"
									className="size-14 rounded-lg border border-border bg-muted object-contain"
								/>
							) : null}
							<div className="min-w-0">
								<a
									href={editHref(row)}
									className="font-serif-display text-heading hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
								>
									{title}
								</a>
								<p className="eyebrow mt-1.5 break-words">{describe(row)}</p>
							</div>
							<div className="flex items-center gap-0.5">
								<MoveButtons
									name={title}
									index={index}
									count={rows.length}
									onMove={(delta) => order.move(index, delta)}
								/>
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
									onClick={() => setDeleting(row)}
									aria-label={`Borrar ${title}`}
								>
									<Trash2 aria-hidden="true" />
								</Button>
							</div>
						</div>
					);
				}}
			/>

			<ConfirmDelete
				open={deleting !== null}
				onOpenChange={(open) => !open && setDeleting(null)}
				name={deleting ? getTitle(deleting) : ""}
				consequence={deleteConsequence}
				busy={busy}
				onConfirm={remove}
			/>
		</>
	);
}
