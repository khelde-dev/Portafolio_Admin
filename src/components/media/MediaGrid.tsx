import type { ReactNode } from "react";
import { LocalTime } from "@/components/LocalTime";
import { MediaImage } from "@/components/media/MediaImage";
import {
	FIELD_LABELS,
	type MediaObject,
	shortKey,
	usageHref,
} from "@/components/media/mediaTypes";
import { StatusBadge } from "@/components/StatusBadge";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/webp";

interface Props {
	objects: readonly MediaObject[];
	label: string;
	/** Accion por imagen (borrar, elegir…). */
	action?: (object: MediaObject) => ReactNode;
	/** Si se da, toda la miniatura es un boton que elige la imagen. */
	onPick?: (object: MediaObject) => void;
	selectedKey?: string | null;
}

/**
 * Rejilla de miniaturas. La miniatura es lo que importa (es una biblioteca de
 * imagenes); debajo, la clave en mono, el peso y donde se usa, con palabra.
 */
export const MediaGrid = ({
	objects,
	label,
	action,
	onPick,
	selectedKey,
}: Props) => (
	<ul
		aria-label={label}
		className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4"
	>
		{objects.map((object) => {
			const thumb = (
				<MediaImage
					mediaKey={object.key}
					loading="lazy"
					className="aspect-square w-full object-contain"
				/>
			);
			const selected = selectedKey === object.key;
			return (
				<li key={object.key} className="flex min-w-0 flex-col gap-2">
					{onPick ? (
						<button
							type="button"
							onClick={() => onPick(object)}
							aria-pressed={selected}
							aria-label={`Elegir ${object.key}`}
							className={cn(
								"overflow-hidden rounded-lg border bg-muted transition-colors hover:border-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
								selected
									? "border-primary ring-2 ring-primary/40"
									: "border-border",
							)}
						>
							{thumb}
						</button>
					) : (
						<div className="overflow-hidden rounded-lg border border-border bg-muted">
							{thumb}
						</div>
					)}

					<div className="min-w-0 text-sm">
						<p className="eyebrow truncate" title={object.key}>
							{shortKey(object.key)}
						</p>
						<p className="mt-0.5 text-muted-foreground">
							{formatBytes(object.size)}, <LocalTime value={object.uploaded} />
						</p>
						<div className="mt-1.5">
							{object.usedBy.length === 0 ? (
								<StatusBadge tone="warning">Sin uso</StatusBadge>
							) : (
								<ul className="flex flex-col gap-0.5" aria-label="Dónde se usa">
									{object.usedBy.map((use) => {
										const href = usageHref(use);
										const text = `${use.label} (${FIELD_LABELS[use.field] ?? use.field})`;
										return (
											<li
												key={`${use.resource}-${use.id}-${use.field}`}
												className="truncate"
											>
												{href ? (
													<a
														className="text-primary underline-offset-4 hover:underline"
														href={href}
													>
														{text}
													</a>
												) : (
													text
												)}
											</li>
										);
									})}
								</ul>
							)}
						</div>
						{action ? <div className="mt-2">{action(object)}</div> : null}
					</div>
				</li>
			);
		})}
	</ul>
);
