import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger";

const DOT: Record<Tone, string> = {
	neutral: "bg-muted-foreground",
	primary: "bg-primary",
	success: "bg-success",
	warning: "bg-warning",
	danger: "bg-destructive",
};

/**
 * Estado con PALABRA y punto: el color acompana, nunca es la unica pista
 * (UI_STANDARDS §8). El texto siempre usa el color de lectura normal.
 */
export const StatusBadge = ({
	tone = "neutral",
	children,
	className,
}: {
	tone?: Tone;
	children: ReactNode;
	className?: string;
}) => (
	<span
		className={cn(
			"inline-flex items-center gap-2 rounded-full border border-border px-2.5 py-0.5 text-sm font-medium",
			className,
		)}
	>
		<span aria-hidden="true" className={cn("size-2 rounded-full", DOT[tone])} />
		{children}
	</span>
);
