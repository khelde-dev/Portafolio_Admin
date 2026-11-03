import { ArrowDown, ArrowUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Subir y bajar un elemento (con teclado, sin arrastrar). El nombre dice a quien mueve. */
export const MoveButtons = ({
	name,
	index,
	count,
	onMove,
}: {
	name: string;
	index: number;
	count: number;
	onMove: (delta: number) => void;
}) => (
	<span className="inline-flex">
		<Button
			type="button"
			variant="ghost"
			size="icon"
			className="size-11"
			disabled={index === 0}
			onClick={() => onMove(-1)}
			aria-label={`Subir ${name}`}
		>
			<ArrowUp aria-hidden="true" />
		</Button>
		<Button
			type="button"
			variant="ghost"
			size="icon"
			className="size-11"
			disabled={index === count - 1}
			onClick={() => onMove(1)}
			aria-label={`Bajar ${name}`}
		>
			<ArrowDown aria-hidden="true" />
		</Button>
	</span>
);

/** Barra "Guardar orden / Descartar" que aparece solo cuando el orden cambio. */
export const OrderBar = ({
	dirty,
	saving,
	error,
	onSave,
	onDiscard,
}: {
	dirty: boolean;
	saving: boolean;
	error: string | null;
	onSave: () => void;
	onDiscard: () => void;
}) =>
	dirty || error ? (
		<div
			className={cn(
				"sticky top-16 z-20 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3",
			)}
		>
			{error ? (
				<Alert variant="destructive" className="border-0 bg-transparent p-0">
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			) : (
				<output className="eyebrow block">
					El orden cambió y todavía no se guarda
				</output>
			)}
			<div className="flex gap-2">
				<Button
					type="button"
					variant="ghost"
					className="min-h-11"
					onClick={onDiscard}
					disabled={saving}
				>
					Descartar
				</Button>
				<Button
					type="button"
					className="min-h-11"
					onClick={onSave}
					disabled={saving || !dirty}
					aria-busy={saving}
				>
					{saving ? "Guardando…" : "Guardar orden"}
				</Button>
			</div>
		</div>
	) : null;
