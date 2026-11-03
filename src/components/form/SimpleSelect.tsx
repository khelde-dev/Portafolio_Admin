import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface SelectOption {
	value: string;
	label: string;
}

interface Props {
	id?: string;
	value: string;
	onValueChange: (value: string) => void;
	options: readonly SelectOption[];
	/** Lo que se ve mientras no hay nada elegido (`value === ""` y ninguna opcion vale ""). */
	placeholder?: string;
	className?: string;
	"aria-label"?: string;
	"aria-invalid"?: boolean;
	"aria-describedby"?: string;
}

/**
 * Selector de una lista corta con los primitivos de shadcn (Base UI). Es el unico
 * lugar que arma `Select` + `SelectTrigger` + `SelectContent`: los formularios y
 * los filtros lo usan en vez de un `<select>` a mano. Un valor `""` es "sin
 * elegir" (muestra el placeholder), salvo que una opcion valga `""` a proposito
 * (p. ej. "Todas las categorias").
 */
/** Base UI trata `""` como "sin valor"; una opcion que vale `""` se maneja con este centinela. */
const EMPTY = "__empty__";
const encode = (value: string) => (value === "" ? EMPTY : value);
const decode = (value: string) => (value === EMPTY ? "" : value);

export const SimpleSelect = ({
	id,
	value,
	onValueChange,
	options,
	placeholder = "Elige una opción",
	className,
	...aria
}: Props) => {
	const hasEmptyOption = options.some((option) => option.value === "");
	const items = options.map((option) => ({
		value: encode(option.value),
		label: option.label,
	}));
	return (
		<Select
			value={value === "" && !hasEmptyOption ? null : encode(value)}
			onValueChange={(next) =>
				onValueChange(decode((next as string | null) ?? ""))
			}
			items={items}
		>
			<SelectTrigger
				id={id}
				className={cn("min-h-11 w-full text-base", className)}
				{...aria}
			>
				<SelectValue placeholder={placeholder} />
			</SelectTrigger>
			<SelectContent>
				{items.map((item) => (
					<SelectItem key={item.value} value={item.value}>
						{item.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
};
