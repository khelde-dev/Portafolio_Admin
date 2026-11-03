import { Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { FilterToggle } from "@/components/form/FilterToggle";
import { SimpleSelect } from "@/components/form/SimpleSelect";
import { ImageUploader } from "@/components/media/ImageUploader";
import { MediaGrid } from "@/components/media/MediaGrid";
import { keyToPath, type MediaListing } from "@/components/media/mediaTypes";
import { PageControls, usePaged } from "@/components/PageControls";
import { EmptyState, ErrorState } from "@/components/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useDeleteTarget } from "@/hooks/useDeleteTarget";
import { useUrlParam } from "@/hooks/useUrlParams";
import { ApiFailure, api } from "@/lib/apiClient";
import { UPLOAD_USES, type UploadUse } from "@/lib/webp";

interface Props {
	initial: MediaListing | null;
	initialError?: string | null;
}

type Filter = "all" | "unused";

/**
 * Biblioteca de medios (`/medios`): sube imagenes (siempre WebP), muestra donde
 * se usa cada una y deja borrar las que ya no usa nada. R2 no tiene papelera:
 * el borrado es definitivo y el backend lo rechaza (409) si algo la usa.
 */
export const MediaLibrary = ({ initial, initialError = null }: Props) => {
	const [listing, setListing] = useState<MediaListing>(
		initial ?? { objects: [], truncated: false },
	);
	const [loadError, setLoadError] = useState<string | null>(initialError);
	// El filtro, el tipo de subida y el modal de borrar viven en la URL (?ver, ?tipo, ?borrar).
	const [filterRaw, setFilter] = useUrlParam("ver", "all", {
		resetsPage: true,
	});
	const filter: Filter = filterRaw === "unused" ? "unused" : "all";
	const [useRaw, setUse] = useUrlParam("tipo", "card");
	const use = (
		Object.hasOwn(UPLOAD_USES, useRaw) ? useRaw : "card"
	) as UploadUse;
	const [notice, setNotice] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const uid = useId();
	const uploadId = `${uid}-subir`;
	const useSelectId = `${uid}-uso`;
	const libraryId = `${uid}-biblioteca`;

	const unused = useMemo(
		() => listing.objects.filter((o) => o.usedBy.length === 0),
		[listing],
	);
	const visible = filter === "unused" ? unused : listing.objects;
	const paged = usePaged(visible);
	const { deleting, requestDelete, cancelDelete } = useDeleteTarget(
		listing.objects,
		(object) => object.key,
	);

	const reload = async () => {
		setLoadError(null);
		try {
			setListing(
				(await api.get<MediaListing>("/api/media")) ?? {
					objects: [],
					truncated: false,
				},
			);
		} catch (error) {
			setLoadError(
				error instanceof ApiFailure ? error.message : "No se pudo cargar.",
			);
		}
	};

	const remove = async () => {
		if (!deleting) return;
		setBusy(true);
		try {
			await api.delete(`/api/media/${keyToPath(deleting.key)}`);
			setListing((l) => ({
				...l,
				objects: l.objects.filter((o) => o.key !== deleting.key),
			}));
			cancelDelete();
		} catch (error) {
			cancelDelete();
			setNotice(
				error instanceof ApiFailure
					? error.message
					: "No se pudo borrar la imagen.",
			);
			// Si alguien la uso mientras tanto, la lista se refresca para reflejarlo.
			if (error instanceof ApiFailure && error.status === 409) void reload();
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className="flex flex-col gap-10">
			<section
				aria-labelledby={uploadId}
				className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10"
			>
				<header>
					<h2 id={uploadId} className="font-serif-display text-heading">
						Subir imagen
					</h2>
					<p className="mt-2 text-sm text-muted-foreground">
						Toda imagen se guarda en WebP. La conversión ocurre en tu navegador.
					</p>
				</header>
				<div className="flex min-w-0 flex-col gap-4">
					<div className="flex max-w-sm flex-col gap-1.5">
						<Label
							htmlFor={useSelectId}
							className="text-[0.9375rem] font-medium"
						>
							¿Para qué es?
						</Label>
						<SimpleSelect
							id={useSelectId}
							value={use}
							onValueChange={(value) => setUse(value, { push: true })}
							options={Object.entries(UPLOAD_USES).map(([value, spec]) => ({
								value,
								label: spec.label,
							}))}
						/>
					</div>
					<ImageUploader use={use} onUploaded={() => void reload()} />
				</div>
			</section>

			<section
				aria-labelledby={libraryId}
				className="border-t border-border pt-8"
			>
				<div className="mb-5 flex flex-wrap items-end justify-between gap-3">
					<h2 id={libraryId} className="font-serif-display text-heading">
						Biblioteca
					</h2>
					<FilterToggle
						label="Filtrar imágenes"
						value={filter}
						onValueChange={(value) => setFilter(value, { push: true })}
						options={[
							{ value: "all", label: `Todas ${listing.objects.length}` },
							{ value: "unused", label: `Sin uso ${unused.length}` },
						]}
					/>
				</div>

				{notice ? (
					<Alert variant="destructive" className="mb-5">
						<AlertDescription>{notice}</AlertDescription>
					</Alert>
				) : null}

				{loadError && listing.objects.length === 0 ? (
					<ErrorState
						title="No se pudo cargar la biblioteca"
						description={loadError}
						onRetry={reload}
					/>
				) : listing.objects.length === 0 ? (
					<EmptyState
						title="Todavía no hay imágenes"
						description="Sube la primera arriba: se guardará en WebP."
					/>
				) : visible.length === 0 ? (
					<EmptyState
						title="No hay imágenes sin uso"
						description="Todas las imágenes de la biblioteca están en uso."
					/>
				) : (
					<>
						<MediaGrid
							objects={paged.shown}
							label="Imágenes"
							action={(object) =>
								object.usedBy.length === 0 ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="min-h-11 px-2"
										onClick={() => requestDelete(object)}
									>
										<Trash2 aria-hidden="true" /> Borrar
									</Button>
								) : null
							}
						/>
						<div className="mt-6">
							<PageControls {...paged} />
						</div>
						{listing.truncated ? (
							<p className="mt-6 text-sm text-muted-foreground">
								Hay más imágenes de las que se pueden mostrar aquí (se listan
								las primeras 5 000).
							</p>
						) : null}
					</>
				)}
			</section>

			<ConfirmDelete
				open={deleting !== null}
				onOpenChange={(open) => !open && cancelDelete()}
				name={deleting?.key ?? ""}
				consequence="La imagen se borra de R2 de forma definitiva: no hay papelera. Ningún elemento la usa."
				busy={busy}
				onConfirm={remove}
			/>
		</div>
	);
};
