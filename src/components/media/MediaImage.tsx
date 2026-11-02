import { ImageOff } from "lucide-react";
import { useState } from "react";
import { mediaUrl } from "@/lib/media";
import { cn } from "@/lib/utils";

interface Props {
	/** Clave en R2 (`gcp.webp`), nunca una URL. */
	mediaKey: string;
	alt?: string;
	className?: string;
	loading?: "lazy" | "eager";
	/** En miniaturas grandes, dice con palabras que el archivo falta. */
	showLabel?: boolean;
}

/**
 * Una imagen del bucket. Si el archivo no existe (la base apunta a una clave que
 * nunca se subio) se ve un aviso con icono y texto, no un icono roto del navegador.
 */
export const MediaImage = ({
	mediaKey,
	alt = "",
	className,
	loading,
	showLabel = false,
}: Props) => {
	const src = mediaUrl(mediaKey);
	const [failed, setFailed] = useState<string | null>(null);

	if (failed === src) {
		return (
			<div
				title={`No se encontró «${mediaKey}» en R2`}
				className={cn(
					"grid place-items-center gap-1 border border-dashed border-border bg-muted p-1 text-center text-muted-foreground",
					className,
				)}
			>
				<ImageOff aria-hidden="true" className="size-5" />
				{showLabel ? (
					<span className="text-xs leading-tight">No está en R2</span>
				) : (
					<span className="sr-only">No se encontró {mediaKey} en R2</span>
				)}
			</div>
		);
	}

	return (
		<img
			src={src}
			alt={alt}
			loading={loading}
			decoding="async"
			onError={() => setFailed(src)}
			className={className}
		/>
	);
};
