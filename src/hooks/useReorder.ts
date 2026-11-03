import { useCallback, useMemo, useState } from "react";
import { toast } from "@/components/Toaster";
import { ApiFailure, api } from "@/lib/apiClient";

/** Mueve el elemento `from` a `to` (sin mutar la lista). */
export const moveItem = <T>(
	list: readonly T[],
	from: number,
	to: number,
): T[] => {
	if (
		from === to ||
		from < 0 ||
		to < 0 ||
		from >= list.length ||
		to >= list.length
	) {
		return [...list];
	}
	const next = [...list];
	const [item] = next.splice(from, 1);
	next.splice(to, 0, item);
	return next;
};

/**
 * Orden editable de una lista: se mueve arrastrando o con botones (Subir/Bajar) y se guarda
 * todo junto con "Guardar orden" (`PUT /api/<recurso>/order`, una transaccion).
 * `sort_order` queda igual a la posicion (0, 1, 2…).
 */
export const useReorder = <T>(
	initial: readonly T[],
	getId: (row: T) => number,
	resource: string,
) => {
	const [rows, setRows] = useState<T[]>([...initial]);
	const [saved, setSaved] = useState<number[]>(() => initial.map(getId));
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const dirty = useMemo(
		() =>
			rows.length !== saved.length ||
			rows.some((row, i) => getId(row) !== saved[i]),
		[rows, saved, getId],
	);

	const move = useCallback((from: number, delta: number) => {
		setRows((list) => moveItem(list, from, from + delta));
	}, []);

	/** Lleva el elemento de la posicion `from` a la `to` (arrastrar y soltar). */
	const moveTo = useCallback((from: number, to: number) => {
		setRows((list) => moveItem(list, from, to));
	}, []);

	/** Reemplaza las filas (tras crear, borrar o recargar) y toma ese orden como el guardado. */
	const replace = useCallback(
		(next: readonly T[]) => {
			setRows([...next]);
			setSaved(next.map(getId));
		},
		[getId],
	);

	const save = useCallback(async () => {
		setSaving(true);
		setError(null);
		try {
			await api.put(
				`/api/${resource}/order`,
				rows.map((row, index) => ({ id: getId(row), sort_order: index })),
			);
			setSaved(rows.map(getId));
			toast.success("Orden guardado");
		} catch (failure) {
			setError(
				failure instanceof ApiFailure
					? failure.message
					: "No se pudo guardar el orden.",
			);
		} finally {
			setSaving(false);
		}
	}, [rows, getId, resource]);

	const discard = useCallback(() => {
		setRows((list) => {
			const byId = new Map(list.map((row) => [getId(row), row]));
			return saved.flatMap((id) => (byId.has(id) ? [byId.get(id) as T] : []));
		});
		setError(null);
	}, [saved, getId]);

	return { rows, move, moveTo, replace, save, discard, dirty, saving, error };
};
