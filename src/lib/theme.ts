/**
 * Tema claro/oscuro. Misma mecanica que el portafolio: la clase `dark` en
 * <html> y la preferencia en localStorage["theme"] ("light" | "dark"); sin
 * valor = seguir al sistema. El script en linea de Layout.astro la aplica antes
 * del primer pintado para que no haya parpadeo.
 */
export type ThemePref = "system" | "light" | "dark";

const KEY = "theme";
const QUERY = "(prefers-color-scheme: dark)";

export const readThemePref = (): ThemePref => {
	try {
		const value = localStorage.getItem(KEY);
		return value === "light" || value === "dark" ? value : "system";
	} catch {
		// Modo privado o almacenamiento bloqueado: se sigue al sistema.
		return "system";
	}
};

export const isDarkFor = (pref: ThemePref, systemDark: boolean): boolean =>
	pref === "system" ? systemDark : pref === "dark";

export const applyThemePref = (pref: ThemePref): boolean => {
	const dark = isDarkFor(pref, window.matchMedia(QUERY).matches);
	document.documentElement.classList.toggle("dark", dark);
	document.documentElement.style.colorScheme = dark ? "dark" : "light";
	return dark;
};

export const saveThemePref = (pref: ThemePref): void => {
	try {
		if (pref === "system") localStorage.removeItem(KEY);
		else localStorage.setItem(KEY, pref);
	} catch {
		// Sin almacenamiento el tema vale solo para esta pagina.
	}
};

/** Avisa cuando el sistema cambia de tema (solo importa con "Sistema"). */
export const watchSystemTheme = (onChange: () => void): (() => void) => {
	const media = window.matchMedia(QUERY);
	media.addEventListener("change", onChange);
	return () => media.removeEventListener("change", onChange);
};
