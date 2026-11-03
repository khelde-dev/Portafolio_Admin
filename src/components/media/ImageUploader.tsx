import { ImageUp, RotateCcw } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiFailure, apiUpload, type UploadedImage } from "@/lib/apiClient";
import {
	ACCEPT_ATTRIBUTE,
	convertToWebp,
	formatBytes,
	ImageError,
	UPLOAD_USES,
	type UploadUse,
	type WebpResult,
} from "@/lib/webp";

interface Props {
	use: UploadUse;
	onUploaded: (image: UploadedImage) => void;
	/** Para pruebas: otro convertidor. */
	convert?: typeof convertToWebp;
}

type Phase =
	| { step: "idle" }
	| { step: "converting" }
	| { step: "ready"; result: WebpResult; preview: string; name: string }
	| { step: "uploading"; result: WebpResult; preview: string; name: string };

/**
 * Elige una imagen, la convierte a WebP en el navegador, muestra el antes y el
 * despues y solo entonces la sube. Nunca se sube nada que no sea WebP: si el
 * navegador no sabe crearlo, se dice y se para.
 */
export const ImageUploader = ({
	use,
	onUploaded,
	convert = convertToWebp,
}: Props) => {
	const spec = UPLOAD_USES[use];
	const inputId = useId();
	const [phase, setPhase] = useState<Phase>({ step: "idle" });
	const [error, setError] = useState<string | null>(null);

	// Libera la URL temporal de la vista previa.
	const preview =
		phase.step === "ready" || phase.step === "uploading" ? phase.preview : null;
	useEffect(
		() => () => {
			if (preview) URL.revokeObjectURL(preview);
		},
		[preview],
	);

	const reset = () => {
		setPhase({ step: "idle" });
		setError(null);
		const field = document.getElementById(inputId) as HTMLInputElement | null;
		if (field) field.value = "";
	};

	const choose = async (file: File | undefined) => {
		if (!file) return;
		setError(null);
		setPhase({ step: "converting" });
		try {
			const result = await convert(file, use);
			setPhase({
				step: "ready",
				result,
				preview: URL.createObjectURL(result.blob),
				name: file.name,
			});
		} catch (failure) {
			setPhase({ step: "idle" });
			setError(
				failure instanceof ImageError
					? failure.message
					: "No se pudo preparar la imagen.",
			);
		}
	};

	const upload = async () => {
		if (phase.step !== "ready") return;
		const { result, preview: url, name } = phase;
		setPhase({ step: "uploading", result, preview: url, name });
		try {
			const uploaded = await apiUpload(spec.folder, result.blob);
			onUploaded(uploaded);
			reset();
		} catch (failure) {
			setPhase({ step: "ready", result, preview: url, name });
			setError(
				failure instanceof ApiFailure
					? failure.message
					: "No se pudo subir la imagen.",
			);
		}
	};

	return (
		<div className="flex flex-col gap-4">
			<div>
				<Input
					id={inputId}
					type="file"
					accept={ACCEPT_ATTRIBUTE}
					className="sr-only"
					tabIndex={-1}
					aria-label="Archivo de imagen"
					onChange={(event) => void choose(event.target.files?.[0])}
					disabled={phase.step === "converting" || phase.step === "uploading"}
				/>
				<Button
					type="button"
					variant="outline"
					className="min-h-11 px-4"
					disabled={phase.step === "converting" || phase.step === "uploading"}
					onClick={() => document.getElementById(inputId)?.click()}
				>
					<ImageUp aria-hidden="true" />
					{phase.step === "converting" ? "Preparando…" : "Elegir imagen"}
				</Button>
				<p className="mt-2 text-sm text-muted-foreground">
					{spec.label}: PNG, JPG, WebP o AVIF. Se convierte a WebP de hasta{" "}
					{formatBytes(spec.maxBytes)} y {spec.maxSide} px.
				</p>
			</div>

			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			{phase.step === "ready" || phase.step === "uploading" ? (
				<figure className="flex flex-col gap-3 sm:flex-row sm:items-start">
					{/* Vista previa de lo que se va a subir (ya convertido). */}
					<img
						src={phase.preview}
						alt={`Vista previa de ${phase.name}`}
						width={phase.result.width}
						height={phase.result.height}
						className="max-h-48 w-auto max-w-full rounded-lg border border-border bg-muted object-contain"
					/>
					<figcaption className="text-sm">
						<p className="font-medium">{phase.name}</p>
						<p className="eyebrow mt-1">
							{formatBytes(phase.result.originalBytes)} a{" "}
							{formatBytes(phase.result.blob.size)}, {phase.result.width} ×{" "}
							{phase.result.height} px
						</p>
						<div className="mt-3 flex flex-wrap gap-2">
							<Button
								type="button"
								className="min-h-11"
								onClick={upload}
								disabled={phase.step === "uploading"}
								aria-busy={phase.step === "uploading"}
							>
								{phase.step === "uploading" ? "Subiendo…" : "Subir imagen"}
							</Button>
							<Button
								type="button"
								variant="ghost"
								className="min-h-11"
								onClick={reset}
								disabled={phase.step === "uploading"}
							>
								<RotateCcw aria-hidden="true" /> Elegir otra
							</Button>
						</div>
					</figcaption>
				</figure>
			) : null}
		</div>
	);
};
