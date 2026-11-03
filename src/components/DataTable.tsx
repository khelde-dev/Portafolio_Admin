import { Search } from "lucide-react";
import { type ReactNode, useId, useMemo } from "react";
import { SimpleSelect } from "@/components/form/SimpleSelect";
import { ListPagination } from "@/components/ListPagination";
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
import { setUrlParams, useUrlParam } from "@/hooks/useUrlParams";
import { cn } from "@/lib/utils";

export interface Column<T> {
	id: string;
	/** Encabezado; en columnas sin texto (imagen, acciones) solo lo leen los lectores de pantalla. */
	header: string;
	hideHeader?: boolean;
	className?: string;
	cell: (row: T) => ReactNode;
}

/** Filas por pagina que se pueden elegir. */
export const PAGE_SIZES = [5, 10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;

const pageSizeOf = (raw: string): number => {
	const n = Number(raw);
	return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
};
const pageOf = (raw: string): number => {
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n >= 1 ? n : 1;
};

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
	const [pageRaw] = useUrlParam("pagina", "1");
	const [sizeRaw, setSizeRaw] = useUrlParam("por", String(DEFAULT_PAGE_SIZE), {
		resetsPage: true,
	});
	const searchId = useId();
	const sizeId = useId();

	const pageSize = pageSizeOf(sizeRaw);
	const visible = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q || !searchText) return rows;
		return rows.filter((row) => searchText(row).toLowerCase().includes(q));
	}, [rows, query, searchText]);

	const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
	const current = Math.min(pageOf(pageRaw), pageCount);
	const shown = visible.slice((current - 1) * pageSize, current * pageSize);

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

					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="flex items-center gap-2">
							<Label htmlFor={sizeId} className="text-sm text-muted-foreground">
								Filas por página
							</Label>
							<SimpleSelect
								id={sizeId}
								value={String(pageSize)}
								onValueChange={setSizeRaw}
								options={PAGE_SIZES.map((n) => ({
									value: String(n),
									label: String(n),
								}))}
								className="w-24"
							/>
						</div>
						<ListPagination
							page={current}
							pageCount={pageCount}
							onPageChange={(page) =>
								setUrlParams(
									{ pagina: page === 1 ? null : String(page) },
									{ push: true },
								)
							}
							hrefFor={pageHref}
						/>
					</div>
				</>
			)}
		</div>
	);
}

/** URL de otra pagina conservando el resto de parametros (busqueda, filtros, tamano). */
const pageHref = (page: number): string => {
	if (typeof window === "undefined") return `?pagina=${page}`;
	const url = new URL(window.location.href);
	if (page === 1) url.searchParams.delete("pagina");
	else url.searchParams.set("pagina", String(page));
	return `${url.pathname}${url.search}`;
};
