import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

interface Props<T extends string> {
	/** Nombre accesible del grupo ("Estado"). */
	label: string;
	value: T;
	onValueChange: (value: T) => void;
	options: readonly { value: T; label: string }[];
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
		>
			{options.map((option) => (
				<ToggleGroupItem
					key={option.value}
					value={option.value}
					className="min-h-11 px-3 text-[0.9375rem]"
				>
					{option.label}
				</ToggleGroupItem>
			))}
		</ToggleGroup>
	);
}
