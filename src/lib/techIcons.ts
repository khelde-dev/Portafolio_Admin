import { PUBLIC_ICONS_URL } from "astro:env/client";

/**
 * Tecnologias (`images_topics`). El sitio las convierte en un icono con
 * `<PUBLIC_ICONS_URL>?i=<nombre>`; un nombre inventado produce un icono roto, asi
 * que el campo es un selector y no un texto libre. Esta lista sale de los nombres
 * que YA usan los proyectos y las habilidades; una nueva se agrega con
 * "Agregar otra" (con vista previa para comprobar que existe) y, si se vuelve
 * habitual, se suma aqui con un PR.
 */
export const KNOWN_TECHNOLOGIES = [
	"apidog",
	"astro",
	"aws",
	"axios",
	"bootstrap",
	"bun",
	"chartjs",
	"cloudflare",
	"css",
	"daisyui",
	"drizzle",
	"express",
	"firebase",
	"framer",
	"git",
	"github",
	"githubpages",
	"hono",
	"html",
	"jest",
	"jira",
	"js",
	"jupyter",
	"jwt",
	"leaflet",
	"lighthouse",
	"matplotlib",
	"miro",
	"mui",
	"mysql",
	"netlify",
	"next",
	"nodejs",
	"npm",
	"numpy",
	"obsidian",
	"pandas",
	"pbi",
	"photoshop",
	"php",
	"pnpm",
	"postgresql",
	"postman",
	"powershell",
	"prisma",
	"python",
	"react",
	"reactquery",
	"seaborn",
	"sequelize",
	"slack",
	"sqlserver",
	"styledcomponents",
	"supabase",
	"swagger",
	"tailwindcss",
	"testinglibrary",
	"ts",
	"turso",
	"vercel",
	"yarn",
	"zustand",
] as const;

/** Forma valida de un nombre de icono: minusculas, digitos y unos pocos signos. */
export const TECH_NAME = /^[a-z0-9][a-z0-9._+-]{0,39}$/;

export const isValidTechName = (name: string): boolean => TECH_NAME.test(name);

/** `react` -> `<PUBLIC_ICONS_URL>?i=react`. El nombre va codificado. */
export const techIconUrl = (name: string): string =>
	`${PUBLIC_ICONS_URL}?i=${encodeURIComponent(name)}`;

/** Sugerencias para el buscador: las que contienen el texto, sin las ya elegidas. */
export const suggestTechnologies = (
	query: string,
	selected: readonly string[],
	limit = 8,
): string[] => {
	const q = query.trim().toLowerCase();
	return KNOWN_TECHNOLOGIES.filter(
		(name) => !selected.includes(name) && (q === "" || name.includes(q)),
	).slice(0, limit);
};
