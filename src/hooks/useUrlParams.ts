import { useCallback, useMemo, useSyncExternalStore } from "react";

/**
 * El estado de una pantalla que se puede compartir o recargar (busqueda, filtros,
 * pagina, el modal abierto) vive en la URL, no solo en `useState`. Asi la URL
 * siempre dice donde estas, el boton Atras deshace el ultimo cambio y un enlace
 * abre la pantalla tal como se dejo.
 *
 * Es un almacen externo: `history.pushState` no avisa a nadie, asi que las
 * escrituras pasan por `setUrlParams`, que notifica a los componentes
 * suscritos. En el servidor (SSR) no hay URL de navegador: el primer render usa
 * los valores por defecto, igual que el HTML del servidor, y al hidratar React
 * vuelve a leer la URL real sin avisos de diferencia.
 */
const listeners = new Set<() => void>();

const subscribe = (notify: () => void) => {
	listeners.add(notify);
	window.addEventListener("popstate", notify);
	return () => {
		listeners.delete(notify);
		window.removeEventListener("popstate", notify);
	};
};

const getSnapshot = () => window.location.search;
const getServerSnapshot = () => "";

export interface UrlWriteOptions {
	/** `true` agrega una entrada al historial (Atras la deshace); por defecto reemplaza la actual. */
	push?: boolean;
}

/** Cambia varios parametros a la vez. `null` o `""` quita el parametro. */
export const setUrlParams = (
	updates: Record<string, string | null>,
	{ push = false }: UrlWriteOptions = {},
): void => {
	const url = new URL(window.location.href);
	for (const [key, value] of Object.entries(updates)) {
		if (value === null || value === "") url.searchParams.delete(key);
		else url.searchParams.set(key, value);
	}
	if (url.href === window.location.href) return;
	const next = `${url.pathname}${url.search}${url.hash}`;
	if (push) window.history.pushState(null, "", next);
	else window.history.replaceState(null, "", next);
	for (const notify of listeners) notify();
};

export const useUrlParams = (): URLSearchParams => {
	const search = useSyncExternalStore(
		subscribe,
		getSnapshot,
		getServerSnapshot,
	);
	return useMemo(() => new URLSearchParams(search), [search]);
};

interface ParamOptions {
	/** Al cambiar este parametro, la pagina vuelve a la primera (`pagina` se quita). */
	resetsPage?: boolean;
}

/**
 * Un parametro de la URL como estado: `[valor, cambiar]`. Si el valor es el de
 * por defecto, el parametro no se escribe (la URL queda limpia).
 */
export const useUrlParam = (
	key: string,
	defaultValue = "",
	{ resetsPage = false }: ParamOptions = {},
) => {
	const params = useUrlParams();
	const value = params.get(key) ?? defaultValue;
	const set = useCallback(
		(next: string, options?: UrlWriteOptions) =>
			setUrlParams(
				{
					[key]: next === defaultValue ? null : next,
					...(resetsPage ? { pagina: null } : {}),
				},
				options,
			),
		[key, defaultValue, resetsPage],
	);
	return [value, set] as const;
};
