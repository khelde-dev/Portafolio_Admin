import { useCallback, useEffect, useRef, useState } from "react";
import { ApiFailure, api } from "@/lib/apiClient";

interface State<T> {
	data: T | undefined;
	error: ApiFailure | null;
	loading: boolean;
}

/**
 * Lee `GET <url>` del propio admin. Si la pagina ya trajo los datos del servidor
 * (`initial`), no vuelve a pedirlos al montar: `reload()` los refresca despues
 * de una escritura. Ignora respuestas viejas si llegan fuera de orden.
 */
export const useResource = <T>(url: string, initial?: T) => {
	const [state, setState] = useState<State<T>>({
		data: initial,
		error: null,
		loading: initial === undefined,
	});
	const ticket = useRef(0);

	const reload = useCallback(async () => {
		const mine = ++ticket.current;
		setState((s) => ({ ...s, loading: true, error: null }));
		try {
			const data = await api.get<T>(url);
			if (mine === ticket.current)
				setState({ data, error: null, loading: false });
		} catch (error) {
			if (mine !== ticket.current) return;
			setState((s) => ({
				...s,
				loading: false,
				error:
					error instanceof ApiFailure
						? error
						: new ApiFailure(0, "No se pudo cargar. Intenta de nuevo."),
			}));
		}
	}, [url]);

	// Solo al montar o si cambia la URL (p. ej. un filtro nuevo): `initial` vale
	// unicamente para el primer pintado.
	// biome-ignore lint/correctness/useExhaustiveDependencies: ver arriba
	useEffect(() => {
		if (initial === undefined) void reload();
	}, [reload]);

	return {
		...state,
		reload,
		setData: (data: T) => setState((s) => ({ ...s, data })),
	};
};
