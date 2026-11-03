import { AlertTriangle, Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface StateProps {
	title: string;
	description?: string;
	children?: ReactNode;
}

/** Vacio: no hay nada todavia. Siempre invita a una accion. */
export const EmptyState = ({ title, description, children }: StateProps) => (
	<div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center">
		<Inbox aria-hidden="true" className="size-8 text-muted-foreground" />
		<p className="font-serif-display text-heading">{title}</p>
		{description ? (
			<p className="max-w-[46ch] text-muted-foreground">{description}</p>
		) : null}
		{children}
	</div>
);

interface ErrorProps extends StateProps {
	onRetry?: () => void;
}

/** Error: dice que fallo y como seguir. `role="alert"` para lectores de pantalla. */
export const ErrorState = ({
	title,
	description,
	onRetry,
	children,
}: ErrorProps) => (
	<div
		role="alert"
		className="flex flex-col items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/5 px-6 py-12 text-center"
	>
		<AlertTriangle aria-hidden="true" className="size-8 text-destructive" />
		<p className="font-serif-display text-heading">{title}</p>
		{description ? (
			<p className="max-w-[46ch] text-muted-foreground">{description}</p>
		) : null}
		{onRetry ? (
			<Button type="button" variant="outline" onClick={onRetry}>
				Reintentar
			</Button>
		) : null}
		{children}
	</div>
);

/** Esqueleto de una lista: la forma de lo que va a llegar, nunca un spinner. */
export const ListSkeleton = ({ rows = 5 }: { rows?: number }) => (
	<output aria-label="Cargando" className="flex flex-col gap-2">
		{Array.from({ length: rows }, (_, i) => (
			// biome-ignore lint/suspicious/noArrayIndexKey: filas de relleno, sin identidad
			<Skeleton key={i} className="h-14 w-full" />
		))}
	</output>
);
