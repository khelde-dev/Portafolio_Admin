import {
	ExternalLink,
	FileText,
	FileUp,
	RotateCcw,
	Trash2,
} from "lucide-react";
import { useId, useState } from "react";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { FormSection } from "@/components/form/FormSection";
import { toast } from "@/components/Toaster";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiFailure, api, apiUploadCv, type CvInfo } from "@/lib/apiClient";
import { cn } from "@/lib/utils";
import { formatBytes } from "@/lib/webp";

/** Mismo tope que el servidor (src/server/cvProxy.ts y el backend). */
export const MAX_CV_BYTES = 5 * 1024 * 1024;

/** Mensaje si el archivo elegido no sirve, o `null` si se puede subir. */
export const cvFileProblem = (file: { type: string; size: number }) => {
	if (file.type !== "application/pdf") return "Elige un archivo PDF.";
	if (file.size === 0) return "El archivo está vacío.";
	if (file.size > MAX_CV_BYTES) {
		return `El PDF pesa ${formatBytes(file.size)}; el máximo es ${formatBytes(MAX_CV_BYTES)}.`;
	}
	return null;
};

interface Props {
	initial: CvInfo | null;
	/** Sin la ficha de textos guardada no hay donde guardar la clave del PDF. */
	canUpload: boolean;
	/** Por que no se pudo leer el PDF actual (backend sin actualizar, sesion...). */
	unavailable?: string | null;
}

const fileName = (key: string) => key.split("/").pop() ?? key;

const uploadedOn = (iso: string | null) =>
	iso
		? new Date(iso).toLocaleDateString("es-MX", {
				year: "numeric",
				month: "long",
				day: "numeric",
			})
		: null;

/**
 * El curriculum que se abre desde el boton "Ver CV" de la portada: UN solo PDF. Subir
 * otro reemplaza al anterior; quitarlo oculta el boton en el sitio.
 */
export const CvManager = ({
	initial,
	canUpload,
	unavailable = null,
}: Props) => {
	const inputId = useId();
	const [cv, setCv] = useState<CvInfo | null>(initial);
	const [picked, setPicked] = useState<File | null>(null);
	const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [confirming, setConfirming] = useState(false);

	const resetInput = () => {
		const field = document.getElementById(inputId) as HTMLInputElement | null;
		if (field) field.value = "";
	};

	const choose = (file: File | undefined) => {
		if (!file) return;
		const problem = cvFileProblem(file);
		setError(problem);
		setPicked(problem ? null : file);
		if (problem) resetInput();
	};

	const cancel = () => {
		setPicked(null);
		setError(null);
		resetInput();
	};

	const upload = async () => {
		if (!picked) return;
		setBusy("upload");
		setError(null);
		try {
			setCv(await apiUploadCv(picked));
			toast.success("Currículum subido");
			cancel();
		} catch (failure) {
			setError(
				failure instanceof ApiFailure
					? failure.message
					: "No se pudo subir el currículum.",
			);
		} finally {
			setBusy(null);
		}
	};

	const remove = async () => {
		setBusy("remove");
		setError(null);
		try {
			await api.delete("/api/cv");
			setCv(null);
			setConfirming(false);
			toast.success("Currículum quitado");
		} catch (failure) {
			setConfirming(false);
			setError(
				failure instanceof ApiFailure
					? failure.message
					: "No se pudo quitar el currículum.",
			);
		} finally {
			setBusy(null);
		}
	};

	const working = busy !== null;
	const date = cv ? uploadedOn(cv.uploaded) : null;

	return (
		<FormSection
			title="Currículum"
			description="El PDF que se abre al pulsar «Ver CV» en la portada. Es un solo archivo: al subir otro, reemplaza al anterior."
		>
			{unavailable ? (
				<Alert variant="destructive">
					<AlertDescription>{unavailable}</AlertDescription>
				</Alert>
			) : !canUpload ? (
				<Alert>
					<AlertDescription>
						Guarda primero los textos del sitio (arriba) para poder subir el
						currículum.
					</AlertDescription>
				</Alert>
			) : null}

			{cv ? (
				<div className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex min-w-0 items-start gap-3">
						<FileText
							aria-hidden="true"
							className="mt-0.5 size-5 shrink-0 text-muted-foreground"
						/>
						<div className="min-w-0">
							<p className="break-all font-medium">{fileName(cv.key)}</p>
							<p className="eyebrow mt-1">
								{[
									cv.size ? formatBytes(cv.size) : null,
									date ? `subido el ${date}` : null,
								]
									.filter(Boolean)
									.join(", ") || "PDF cargado"}
							</p>
						</div>
					</div>
					<div className="flex flex-wrap gap-2">
						{cv.url ? (
							<a
								href={cv.url}
								target="_blank"
								rel="noopener noreferrer"
								className={cn(
									buttonVariants({ variant: "outline" }),
									"min-h-11",
								)}
							>
								<ExternalLink aria-hidden="true" /> Abrir PDF
							</a>
						) : null}
						<Button
							type="button"
							variant="ghost"
							className="min-h-11"
							disabled={working}
							onClick={() => setConfirming(true)}
						>
							<Trash2 aria-hidden="true" /> Quitar
						</Button>
					</div>
				</div>
			) : (
				<p className="text-sm text-muted-foreground">
					Todavía no hay currículum: el botón «Ver CV» no se muestra en el
					sitio.
				</p>
			)}

			{error ? (
				<Alert variant="destructive">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : null}

			{/* `relative`: el input oculto (sr-only) es absoluto; sin un contenedor asomaba
			    por la derecha y ensanchaba la pagina (mismo caso que ImageUploader). */}
			<div className="relative">
				<Input
					id={inputId}
					type="file"
					accept="application/pdf,.pdf"
					className="sr-only"
					tabIndex={-1}
					aria-label="Archivo PDF del currículum"
					onChange={(event) => choose(event.target.files?.[0])}
					disabled={!canUpload || Boolean(unavailable) || working}
				/>
				{picked ? (
					<div className="flex flex-col gap-3">
						<p className="text-sm">
							<span className="font-medium">{picked.name}</span>
							<span className="eyebrow ml-2">{formatBytes(picked.size)}</span>
						</p>
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								className="min-h-11"
								onClick={upload}
								disabled={working}
								aria-busy={busy === "upload"}
							>
								{busy === "upload"
									? "Subiendo…"
									: cv
										? "Reemplazar PDF"
										: "Subir PDF"}
							</Button>
							<Button
								type="button"
								variant="ghost"
								className="min-h-11"
								onClick={cancel}
								disabled={working}
							>
								<RotateCcw aria-hidden="true" /> Elegir otro
							</Button>
						</div>
					</div>
				) : (
					<>
						<Button
							type="button"
							variant="outline"
							className="min-h-11 px-4"
							disabled={!canUpload || Boolean(unavailable) || working}
							onClick={() => document.getElementById(inputId)?.click()}
						>
							<FileUp aria-hidden="true" />
							{cv ? "Elegir un PDF nuevo" : "Elegir PDF"}
						</Button>
						<p className="mt-2 text-sm text-muted-foreground">
							PDF de hasta {formatBytes(MAX_CV_BYTES)}. Se abre en el navegador
							al pulsar «Ver CV».
						</p>
					</>
				)}
			</div>

			<ConfirmDelete
				open={confirming}
				onOpenChange={setConfirming}
				name={cv ? fileName(cv.key) : "currículum"}
				consequence="El botón «Ver CV» dejará de mostrarse en el sitio y el archivo se borra de R2. Esta acción no se puede deshacer."
				confirmLabel="Quitar"
				busy={busy === "remove"}
				onConfirm={remove}
			/>
		</FormSection>
	);
};
