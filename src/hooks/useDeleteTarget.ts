import { useCallback, useMemo } from "react";
import { useUrlParam } from "@/hooks/useUrlParams";

/**
 * El elemento que se esta por borrar vive en la URL (`?borrar=<id>`): el modal de
 * confirmacion queda abierto al recargar, se puede compartir ese estado y el
 * boton Atras lo cierra. Si el id ya no existe (se borro en otra pestana), no hay modal.
 */
export const useDeleteTarget = <T>(
	rows: readonly T[],
	getId: (row: T) => string | number,
) => {
	const [id, setId] = useUrlParam("borrar");
	const deleting = useMemo(
		() => (id ? (rows.find((row) => String(getId(row)) === id) ?? null) : null),
		[id, rows, getId],
	);
	const requestDelete = useCallback(
		(row: T) => setId(String(getId(row)), { push: true }),
		[setId, getId],
	);
	const cancelDelete = useCallback(() => setId(""), [setId]);
	return { deleting, requestDelete, cancelDelete };
};
