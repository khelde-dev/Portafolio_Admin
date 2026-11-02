/**
 * Enlaces al portafolio publico. `PUBLIC_PORTFOLIO_URL` es el ORIGEN del sitio
 * (`https://khelde.dev`); si alguien le deja una ruta (`/es/home`) se descarta,
 * porque las rutas las pone el portafolio y no este panel.
 */
export const siteOrigin = (base: string): string => {
	try {
		return new URL(base).origin;
	} catch {
		return base.replace(/\/+$/, "");
	}
};

/** Pagina publica de un proyecto, en español (el idioma base del sitio). */
export const projectUrl = (base: string, slug: string): string =>
	`${siteOrigin(base)}/es/project/${encodeURIComponent(slug)}`;
