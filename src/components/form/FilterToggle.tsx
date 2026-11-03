import type { ReactNode } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

interface Props<T extends string> {
	/** Nombre accesible del grupo ("Estado"). */
	label: string;
	value: T;
	onValueChange: (value: T) => void;
	options: readonly { value: T; label: ReactNode }[];
	/** Ocupa todo el ancho y reparte las opciones por igual; si no caben, pasan a otra fila. */
	fill?: boolean;
}

/**
 * Filtro de una sola opcion siempre elegida (Todos / Publicados / Borradores),
 * con el `ToggleGroup` de shadcn. Volver a pulsar la elegida no la quita.
 */
export function FilterToggle<T extends string>({
	label,
	value,
	onValueChange,
	options,
	fill = false,
}: Props<T>) {
	return (
		<ToggleGroup
			aria-label={label}
			value={[value]}
			onValueChange={(next) => {
				const chosen = next[0] as T | undefined;
				if (chosen !== undefined) onValueChange(chosen);
			}}
			spacing={1}
			className={fill ? "w-full flex-wrap" : undefined}
		>
			{options.map((option) => (
				<ToggleGroupItem
					key={option.value}
					value={option.value}
					className={cn(
						"min-h-11 px-3 text-[0.9375rem]",
						fill && "flex-auto justify-center",
					)}
				>
					{option.label}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
