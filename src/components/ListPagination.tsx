import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@/components/ui/pagination";

interface Props {
	page: number;
	pageCount: number;
	/** Con esto la pagina cambia sin recargar; sin esto son enlaces normales (paginas del servidor). */
	onPageChange?: (page: number) => void;
	/** URL de cada pagina: se puede abrir en otra pestana y funciona sin JS. */
	hrefFor?: (page: number) => string;
}

/** Que paginas se muestran: la primera, la ultima y las vecinas de la actual; `null` = hueco. */
export const pageWindow = (
	page: number,
	pageCount: number,
): (number | null)[] => {
	const wanted = new Set([1, pageCount, page - 1, page, page + 1]);
	const pages = [...wanted]
		.filter((p) => p >= 1 && p <= pageCount)
		.sort((a, b) => a - b);
	const out: (number | null)[] = [];
	for (const p of pages) {
		const last = out.at(-1);
		if (typeof last === "number" && p - last > 1) out.push(null);
		out.push(p);
	}
	return out;
};

/** Paginacion con los componentes de shadcn. No se muestra si cabe todo en una pagina. */
export const ListPagination = ({
	page,
	pageCount,
	onPageChange,
	hrefFor,
}: Props) => {
	if (pageCount <= 1) return null;

	const link = (target: number) => ({
		href: hrefFor ? hrefFor(target) : "#",
		onClick: onPageChange
			? (event: { preventDefault: () => void }) => {
					event.preventDefault();
					onPageChange(target);
				}
			: undefined,
	});
	const atStart = page <= 1;
	const atEnd = page >= pageCount;

	return (
		<Pagination aria-label="Paginación" className="mx-0 w-auto">
			<PaginationContent className="flex-wrap justify-center">
				<PaginationItem>
					<PaginationPrevious
						text="Anterior"
						aria-label="Ir a la página anterior"
						aria-disabled={atStart || undefined}
						className={atStart ? "pointer-events-none opacity-50" : undefined}
						tabIndex={atStart ? -1 : undefined}
						{...link(Math.max(1, page - 1))}
					/>
				</PaginationItem>
				{pageWindow(page, pageCount).map((p, index) =>
					p === null ? (
						// biome-ignore lint/suspicious/noArrayIndexKey: los huecos no tienen otra identidad
						<PaginationItem key={`gap-${index}`}>
							<PaginationEllipsis />
						</PaginationItem>
					) : (
						<PaginationItem key={p}>
							<PaginationLink
								isActive={p === page}
								aria-label={`Ir a la página ${p}`}
								className="min-h-11 min-w-11"
								{...link(p)}
							>
								{p}
							</PaginationLink>
						</PaginationItem>
					),
				)}
				<PaginationItem>
					<PaginationNext
						text="Siguiente"
						aria-label="Ir a la página siguiente"
						aria-disabled={atEnd || undefined}
						className={atEnd ? "pointer-events-none opacity-50" : undefined}
						tabIndex={atEnd ? -1 : undefined}
						{...link(Math.min(pageCount, page + 1))}
					/>
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
};
