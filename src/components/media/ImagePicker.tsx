import { ArrowDown, ArrowUp, ImagePlus, X } from "lucide-react";
import { useState } from "react";
import { get, useFormContext } from "react-hook-form";
import { FieldShell, fieldIds } from "@/components/form/fields";
import { ImageUploader } from "@/components/media/ImageUploader";
import { MediaGrid } from "@/components/media/MediaGrid";
import { MediaImage } from "@/components/media/MediaImage";
import type { MediaListing } from "@/components/media/mediaTypes";
import { ErrorState, ListSkeleton } from "@/components/states";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useResource } from "@/hooks/useResource";
import type { UploadUse } from "@/lib/webp";

interface DialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	use: UploadUse;
	/** Claves ya elegidas (se marcan en la biblioteca). */
	selected?: readonly string[];
	onPick: (key: string) => void;
}

/** Sube una imagen nueva o elige una de la biblioteca. */
export const MediaPickerDialog = ({
	open,
	onOpenChange,
	use,
	selected = [],
	onPick,
}: DialogProps) => (
	<Dialog open={open} onOpenChange={onOpenChange}>
		<DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl">
			<DialogHeader>
				<DialogTitle>Elegir imagen</DialogTitle>
				<DialogDescription>
					Sube una nueva (se guarda en WebP) o usa una que ya está en la
					biblioteca.
				</DialogDescription>
			</DialogHeader>
			{open ? (
				<PickerBody
					use={use}
					selected={selected}
					onPick={(key) => {
						onPick(key);
						onOpenChange(false);
					}}
				/>
			) : null}
		</DialogContent>
	</Dialog>
);

const PickerBody = ({
	use,
	selected,
	onPick,
}: {
	use: UploadUse;
	selected: readonly string[];
	onPick: (key: string) => void;
}) => {
	const library = useResource<MediaListing>("/api/media");
	return (
		<Tabs defaultValue="upload" className="gap-5">
			<TabsList
				variant="line"
				aria-label="Origen de la imagen"
				className="h-auto flex-wrap"
			>
				<TabsTrigger value="upload" className="min-h-11 px-4">
					Subir nueva
				</TabsTrigger>
				<TabsTrigger value="library" className="min-h-11 px-4">
					Biblioteca
				</TabsTrigger>
			</TabsList>
			<TabsContent value="upload">
				<ImageUploader use={use} onUploaded={(image) => onPick(image.key)} />
			</TabsContent>
			<TabsContent value="library">
				{library.loading && !library.data ? (
					<ListSkeleton rows={3} />
				) : library.error && !library.data ? (
					<ErrorState
						title="No se pudo cargar la biblioteca"
						description={library.error.message}
						onRetry={library.reload}
					/>
				) : (
					<MediaGrid
						objects={library.data?.objects ?? []}
						label="Imágenes de la biblioteca"
						selectedKey={selected[0] ?? null}
						onPick={(object) => onPick(object.key)}
					/>
				)}
			</TabsContent>
		</Tabs>
	);
};

interface FieldProps {
	/** Campo del formulario con la clave (`card_image`, `img`, `image`). */
	name: string;
	label: string;
	hint?: string;
	use: UploadUse;
	required?: boolean;
}

/** Campo de UNA imagen. Nunca se pega una clave a mano: se sube o se elige. */
export const ImagePickerField = ({
	name,
	label,
	hint,
	use,
	required,
}: FieldProps) => {
	const { watch, setValue, formState } = useFormContext();
	const [open, setOpen] = useState(false);
	const value = (watch(name) as string | undefined) ?? "";
	const error = (
		get(formState.errors, name) as { message?: string } | undefined
	)?.message;
	const id = `campo-${name.replaceAll(".", "-")}`;

	return (
		<FieldShell
			id={id}
			label={label}
			hint={hint}
			error={error}
			required={required}
		>
			<div className="flex flex-wrap items-center gap-4">
				{value ? (
					<MediaImage
						mediaKey={value}
						alt={`Imagen actual: ${value}`}
						showLabel
						className="size-24 rounded-lg border border-border bg-muted object-contain"
					/>
				) : (
					<div className="grid size-24 place-items-center rounded-lg border border-dashed border-border text-muted-foreground">
						<ImagePlus aria-hidden="true" />
						<span className="sr-only">Sin imagen</span>
					</div>
				)}
				<div className="flex flex-wrap items-center gap-2">
					<Button
						type="button"
						variant="outline"
						className="min-h-11"
						aria-label={`${value ? "Cambiar" : "Elegir"} ${label.toLowerCase()}`}
						aria-describedby={
							error ? fieldIds(id).error : hint ? fieldIds(id).hint : undefined
						}
						onClick={() => setOpen(true)}
					>
						{value ? "Cambiar imagen" : "Elegir imagen"}
					</Button>
					{value ? (
						<p className="eyebrow max-w-[16rem] truncate" title={value}>
							{value}
						</p>
					) : null}
				</div>
			</div>
			<MediaPickerDialog
				open={open}
				onOpenChange={setOpen}
				use={use}
				selected={value ? [value] : []}
				onPick={(key) =>
					setValue(name, key, { shouldDirty: true, shouldValidate: true })
				}
			/>
		</FieldShell>
	);
};

/** Campo de VARIAS imagenes (la galeria): se agregan, se quitan y se reordenan. */
export const GalleryField = ({
	name,
	label,
	hint,
	use,
}: Omit<FieldProps, "required">) => {
	const { watch, setValue, formState } = useFormContext();
	const [open, setOpen] = useState(false);
	const keys = ((watch(name) as string[] | undefined) ?? []).filter(Boolean);
	const error = (
		get(formState.errors, name) as { message?: string } | undefined
	)?.message;
	const id = `campo-${name.replaceAll(".", "-")}`;

	const set = (next: string[]) =>
		setValue(name, next, { shouldDirty: true, shouldValidate: true });
	const move = (index: number, delta: number) => {
		const next = [...keys];
		const [item] = next.splice(index, 1);
		next.splice(index + delta, 0, item);
		set(next);
	};

	return (
		<FieldShell id={id} label={label} hint={hint} error={error}>
			{keys.length > 0 ? (
				<ul
					aria-label={label}
					className="grid grid-cols-2 gap-3 sm:grid-cols-3"
				>
					{keys.map((key, index) => (
						<li key={key} className="flex flex-col gap-1.5">
							<MediaImage
								mediaKey={key}
								loading="lazy"
								className="aspect-square w-full rounded-lg border border-border bg-muted object-contain"
							/>
							<p className="eyebrow truncate" title={key}>
								{key}
							</p>
							<div className="flex gap-1">
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="size-11"
									disabled={index === 0}
									onClick={() => move(index, -1)}
									aria-label={`Subir ${key}`}
								>
									<ArrowUp aria-hidden="true" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="size-11"
									disabled={index === keys.length - 1}
									onClick={() => move(index, 1)}
									aria-label={`Bajar ${key}`}
								>
									<ArrowDown aria-hidden="true" />
								</Button>
								<Button
									type="button"
									variant="ghost"
									size="icon"
									className="size-11"
									onClick={() => set(keys.filter((_, i) => i !== index))}
									aria-label={`Quitar ${key} de la galería`}
								>
									<X aria-hidden="true" />
								</Button>
							</div>
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground">
					Todavía no hay imágenes en la galería.
				</p>
			)}
			<div>
				<Button
					type="button"
					variant="outline"
					className="min-h-11"
					aria-label={`Agregar imagen a ${label.toLowerCase()}`}
					onClick={() => setOpen(true)}
				>
					<ImagePlus aria-hidden="true" /> Agregar imagen
				</Button>
			</div>
			<MediaPickerDialog
				open={open}
				onOpenChange={setOpen}
				use={use}
				selected={keys}
				onPick={(key) => !keys.includes(key) && set([...keys, key])}
			/>
		</FieldShell>
	);
};
