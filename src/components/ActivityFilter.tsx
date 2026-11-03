import { useId } from "react";
import { SimpleSelect } from "@/components/form/SimpleSelect";
import { Label } from "@/components/ui/label";

interface Props {
	value: string;
	options: readonly { value: string; label: string }[];
}

/**
 * Filtro de Actividad por recurso. Al elegir recarga la pagina con `?recurso=`:
 * el filtro vive en la URL (se puede compartir y el boton Atras funciona) y la
 * lista se filtra en el servidor.
 */
export const ActivityFilter = ({ value, options }: Props) => {
	const id = useId();
	return (
		<div className="flex flex-col gap-1.5">
			<Label htmlFor={id} className="text-[0.9375rem] font-medium">
				Qué cambió
			</Label>
			<SimpleSelect
				id={id}
				value={value}
				className="w-auto min-w-56"
				options={[{ value: "", label: "Todo" }, ...options]}
				onValueChange={(next) => {
					const url = new URL(window.location.href);
					if (next) url.searchParams.set("recurso", next);
					else url.searchParams.delete("recurso");
					window.location.assign(url);
				}}
			/>
		</div>
	);
};
