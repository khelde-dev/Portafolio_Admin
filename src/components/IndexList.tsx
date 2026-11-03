import { Search } from "lucide-react";
import { type ReactNode, useId, useMemo, useState } from "react";
import { EmptyState } from "@/components/states";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props<T> {
	rows: readonly T[];
	getId: (row: T) => string | number;
	/** Contenido de una fila: titulo, datos y acciones. La fila ya trae filete y foco. */
	renderRow: (row: T) => ReactNode;
	/** Texto en el que busca el campo de busqueda; sin esto no hay busqueda. */
	searchText?: (row: T) => string;
	searchLabel?: string;
	/** Filtros propios (pestanas, selectores) a la derecha de la busqueda. */
	filters?: ReactNode;
	/** Nombre accesible de la lista. */
	label: string;
	/** Se muestra cuando NO hay filas en absoluto (no cuando el filtro no encuentra). */
	empty: ReactNode;
	className?: string;
}

/**
 * Lista tipo INDICE: filas separadas por filetes, no una rejilla de tarjetas.
 * El filete es estructura (una fila = un elemento); lo que cuenta de cada fila
 * (titulo en serif, datos en mono, estado con palabra) lo decide `renderRow`.
 * Con cientos de filas como mucho, se filtra aqui, en el navegador.
 */
export function IndexList<T>({
	rows,
	getId,
	renderRow,
	searchText,
	searchLabel = "Buscar",
	filters,
	label,
	empty,
	className,
}: Props<T>) {
	const [query, setQuery] = useState("");
	const searchId = useId();

	const visible = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q || !searchText) return rows;
		return rows.filter((row) => searchText(row).toLowerCase().includes(q));
	}, [rows, query, searchText]);

	if (rows.length === 0) return <>{empty}</>;

	return (
		<div className={cn("flex flex-col gap-4", className)}>
			{searchText || filters ? (
				<div className="flex flex-wrap items-end justify-between gap-3">
					{searchText ? (
						<div className="relative w-full sm:max-w-xs">
							<label htmlFor={searchId} className="sr-only">
								{searchLabel}
							</label>
							<Search
								aria-hidden="true"
								className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								id={searchId}
								type="search"
								value={query}
								onChange={(event) => setQuery(event.target.value)}
								placeholder={searchLabel}
								className="min-h-11 pl-9"
							/>
						</div>
					) : (
						<span />
					)}
					{filters}
				</div>
			) : null}

			<output className="eyebrow block">
				{visible.length === rows.length
					? `${rows.length} ${rows.length === 1 ? "elemento" : "elementos"}`
					: `${visible.length} de ${rows.length}`}
			</output>

			{visible.length === 0 ? (
				<EmptyState
					title="Nada coincide con la búsqueda"
					description="Prueba con otras palabras o borra el filtro."
				/>
			) : (
				<ul aria-label={label} className="border-t border-border">
					{visible.map((row) => (
						<li
							key={getId(row)}
							className="border-b border-border transition-colors hover:bg-muted/50 focus-within:bg-muted/50"
						>
							{renderRow(row)}
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
