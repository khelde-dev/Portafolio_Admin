import { useId } from "react";
import { SimpleSelect } from "@/components/form/SimpleSelect";
import { ListPagination } from "@/components/ListPagination";
import { Label } from "@/components/ui/label";
import { setUrlParams, useUrlParam } from "@/hooks/useUrlParams";

/** Filas por pagina que se pueden elegir. */
export const PAGE_SIZES = [5, 10, 25, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 10;

export const pageSizeOf = (raw: string): number => {
	const n = Number(raw);
	return (PAGE_SIZES as readonly number[]).includes(n) ? n : DEFAULT_PAGE_SIZE;
};

export const pageOf = (raw: string): number => {
	const n = Number.parseInt(raw, 10);
	return Number.isFinite(n) && n >= 1 ? n : 1;
};

/** URL de otra pagina conservando el resto de parametros (busqueda, filtros, tamano). */
export const pageHref = (page: number): string => {
	if (typeof window === "undefined") return `?pagina=${page}`;
	const url = new URL(window.location.href);
	if (page === 1) url.searchParams.delete("pagina");
	else url.searchParams.set("pagina", String(page));
	return `${url.pathname}${url.search}`;
};

export interface Paged<T> {
	shown: T[];
	total: number;
	page: number;
	pageCount: number;
	pageSize: number;
}

/**
 * Pagina una lista en memoria con la pagina (`?pagina`) y el tamano (`?por`) de la
 * URL. Una pagina fuera de rango o un tamano que no esta en la lista caen en uno valido.
 */
export const usePaged = <T,>(items: readonly T[]): Paged<T> => {
	const [pageRaw] = useUrlParam("pagina", "1");
	const [sizeRaw] = useUrlParam("por", String(DEFAULT_PAGE_SIZE));
	const pageSize = pageSizeOf(sizeRaw);
	const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
	const page = Math.min(pageOf(pageRaw), pageCount);
	return {
		shown: items.slice((page - 1) * pageSize, page * pageSize),
		total: items.length,
		page,
		pageCount,
		pageSize,
	};
};

/** Selector de filas por pagina y paginacion, con shadcn; lo comparten todas las listas. */
/** `reload`: la lista la arma el servidor, asi que cambiar el tamano recarga la pagina (los enlaces ya navegan). */
export const PageControls = ({
	page,
	pageCount,
	pageSize,
	reload = false,
}: Pick<Paged<unknown>, "page" | "pageCount" | "pageSize"> & {
	reload?: boolean;
}) => {
	const sizeId = useId();
	const [, setSize] = useUrlParam("por", String(DEFAULT_PAGE_SIZE), {
		resetsPage: true,
	});
	return (
		<div className="flex flex-wrap items-center justify-between gap-3">
			<div className="flex items-center gap-2">
				<Label htmlFor={sizeId} className="text-sm text-muted-foreground">
					Filas por página
				</Label>
				<SimpleSelect
					id={sizeId}
					value={String(pageSize)}
					onValueChange={(value) => {
						if (!reload) return setSize(value);
						const url = new URL(window.location.href);
						if (value === String(DEFAULT_PAGE_SIZE))
							url.searchParams.delete("por");
						else url.searchParams.set("por", value);
						url.searchParams.delete("pagina");
						window.location.assign(url);
					}}
					options={PAGE_SIZES.map((n) => ({
						value: String(n),
						label: String(n),
					}))}
					className="w-24"
				/>
			</div>
			<ListPagination
				page={page}
				pageCount={pageCount}
				onPageChange={
					reload
						? undefined
						: (next) =>
								setUrlParams(
									{ pagina: next === 1 ? null : String(next) },
									{ push: true },
								)
				}
				hrefFor={pageHref}
			/>
		</div>
	);
};
