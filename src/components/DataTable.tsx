import { Search } from "lucide-react";
import { type ReactNode, useId, useMemo } from "react";
import { PageControls, usePaged } from "@/components/PageControls";
import { EmptyState } from "@/components/states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { useUrlParam } from "@/hooks/useUrlParams";
import { cn } from "@/lib/utils";

export interface Column<T> {
	id: string;
	/** Encabezado; en columnas sin texto (imagen, acciones) solo lo leen los lectores de pantalla. */
	header: string;
	hideHeader?: boolean;
	className?: string;
	cell: (row: T) => ReactNode;
}

interface Props<T> {
	rows: readonly T[];
	getId: (row: T) => string | number;
	columns: readonly Column<T>[];
	/** Texto en el que busca el campo de busqueda; sin esto no hay busqueda. */
	searchText?: (row: T) => string;
	searchLabel?: string;
	/** Filtros propios (alternadores, selectores) a la derecha de la busqueda. */
	filters?: ReactNode;
	/** Nombre accesible de la tabla. */
	label: string;
	/** Se muestra cuando NO hay filas y tampoco hay filtros con los que quitarlas. */
	empty: ReactNode;
	className?: string;
}

/**
 * Tabla de una lista del CMS con los componentes de shadcn: busqueda, filtros,
 * paginacion y filas por pagina. La busqueda (`buscar`), la pagina (`pagina`) y
 * el tamano (`por`) viven en la URL; los filtros de fuera tambien deben vivir
 * ahi (ver `useUrlParam`) y cambiarlos vuelve a la primera pagina. Una fila es un
 * elemento; lo que cuenta de cada fila (titulo en serif, datos en mono, estado
 * con palabra) lo decide la `cell` de cada columna. En pantallas chicas las celdas
 * se apilan en vez de desbordar.
 */
export function DataTable<T>({
	rows,
	getId,
	columns,
	searchText,
	searchLabel = "Buscar",
	filters,
	label,
	empty,
	className,
}: Props<T>) {
	const [query, setQuery] = useUrlParam("buscar", "", { resetsPage: true });
	const searchId = useId();

	const visible = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q || !searchText) return rows;
		return rows.filter((row) => searchText(row).toLowerCase().includes(q));
	}, [rows, query, searchText]);

	const paged = usePaged(visible);
	const { shown, page: current, pageCount } = paged;

	// Sin filas y sin filtros no hay nada que mostrar; con filtros (aunque dejen
	// cero filas) se conservan para poder quitarlos.
	if (rows.length === 0 && !filters && !query) return <>{empty}</>;

	return (
		<div className={cn("flex flex-col gap-4", className)}>
			{searchText || filters ? (
				<div className="flex flex-wrap items-end justify-between gap-3">
					{searchText ? (
						<div className="relative w-full sm:max-w-xs">
							<Label htmlFor={searchId} className="sr-only">
								{searchLabel}
							</Label>
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
				{`${visible.length} ${visible.length === 1 ? "elemento" : "elementos"}`}
				{visible.length !== rows.length ? ` de ${rows.length}` : ""}
				{pageCount > 1 ? `, página ${current} de ${pageCount}` : ""}
			</output>

			{visible.length === 0 ? (
				<EmptyState
					title="Nada coincide"
					description="Prueba con otras palabras o cambia los filtros."
				/>
			) : (
				<>
					<Table aria-label={label}>
						<TableHeader className="max-md:sr-only">
							<TableRow>
								{columns.map((column) => (
									<TableHead
										key={column.id}
										className={cn(column.hideHeader && "w-0", column.className)}
									>
										{column.hideHeader ? (
											<span className="sr-only">{column.header}</span>
										) : (
											column.header
										)}
									</TableHead>
								))}
							</TableRow>
						</TableHeader>
						<TableBody>
							{shown.map((row) => (
								<TableRow
									key={getId(row)}
									className="max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-4"
								>
									{columns.map((column) => (
										<TableCell
											key={column.id}
											className={cn(
												"whitespace-normal align-middle",
												column.className,
											)}
										>
											{column.cell(row)}
										</TableCell>
									))}
								</TableRow>
							))}
						</TableBody>
					</Table>

					<PageControls {...paged} />
				</>
			)}
		</div>
	);
}
