import { Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { ImageUploader } from "@/components/media/ImageUploader";
import { MediaGrid } from "@/components/media/MediaGrid";
import {
	keyToPath,
	type MediaListing,
	type MediaObject,
} from "@/components/media/mediaTypes";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { ApiFailure, api } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
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
	const [filter, setFilter] = useState<Filter>("all");
	const [use, setUse] = useState<UploadUse>("card");
	const [notice, setNotice] = useState<string | null>(null);
	const [deleting, setDeleting] = useState<MediaObject | null>(null);
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
			setDeleting(null);
		} catch (error) {
			setDeleting(null);
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
						<label
							htmlFor={useSelectId}
							className="text-[0.9375rem] font-medium"
						>
							¿Para qué es?
						</label>
						<select
							id={useSelectId}
							value={use}
							onChange={(event) => setUse(event.target.value as UploadUse)}
							className="min-h-11 rounded-lg border border-input bg-background px-3 text-base focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
						>
							{Object.entries(UPLOAD_USES).map(([value, spec]) => (
								<option key={value} value={value}>
									{spec.label}
								</option>
							))}
						</select>
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
					<fieldset className="flex min-w-0 gap-1">
						<legend className="sr-only">Filtrar imágenes</legend>
						{(
							[
								["all", `Todas ${listing.objects.length}`],
								["unused", `Sin uso ${unused.length}`],
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
				</div>

				{notice ? (
					<p
						role="alert"
						className="mb-5 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 font-medium text-destructive"
					>
						{notice}
					</p>
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
							objects={visible}
							label="Imágenes"
							action={(object) =>
								object.usedBy.length === 0 ? (
									<Button
										type="button"
										variant="ghost"
										size="sm"
										className="min-h-11 px-2"
										onClick={() => setDeleting(object)}
									>
										<Trash2 aria-hidden="true" /> Borrar
									</Button>
								) : null
							}
						/>
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
				onOpenChange={(open) => !open && setDeleting(null)}
				name={deleting?.key ?? ""}
				consequence="La imagen se borra de R2 de forma definitiva: no hay papelera. Ningún elemento la usa."
				busy={busy}
				onConfirm={remove}
			/>
		</div>
	);
};
