/**
 * Mapa del menu (docs/plan/07-modulos-y-pantallas.md). Solo lo que ya existe:
 * un enlace a una pantalla sin construir seria un callejon sin salida.
 * `icon` es la clave de un icono de Lucide (ver NavList).
 */
export type NavIcon =
	| "dashboard"
	| "inbox"
	| "comments"
	| "projects"
	| "experience"
	| "education"
	| "skills"
	| "about"
	| "media"
	| "contact"
	| "copy"
	| "activity"
	| "status"
	| "account";

export interface NavItem {
	id: string;
	label: string;
	href: string;
	icon: NavIcon;
}

export interface NavGroup {
	label: string | null;
	items: NavItem[];
}

export const NAV: NavGroup[] = [
	{
		label: null,
		items: [{ id: "panel", label: "Panel", href: "/", icon: "dashboard" }],
	},
	{
		label: "Bandeja",
		items: [
			{ id: "mensajes", label: "Mensajes", href: "/mensajes", icon: "inbox" },
			{
				id: "comentarios",
				label: "Comentarios",
				href: "/comentarios",
				icon: "comments",
			},
		],
	},
	{
		label: "Contenido",
		items: [
			{
				id: "proyectos",
				label: "Proyectos",
				href: "/proyectos",
				icon: "projects",
			},
			{
				id: "experiencia",
				label: "Experiencia",
				href: "/experiencia",
				icon: "experience",
			},
			{
				id: "educacion",
				label: "Educación",
				href: "/educacion",
				icon: "education",
			},
			{
				id: "habilidades",
				label: "Habilidades",
				href: "/habilidades",
				icon: "skills",
			},
			{ id: "sobre-mi", label: "Sobre mí", href: "/sobre-mi", icon: "about" },
		],
	},
	{
		label: "Sitio",
		items: [
			{ id: "medios", label: "Medios", href: "/medios", icon: "media" },
			{ id: "textos", label: "Textos", href: "/textos", icon: "copy" },
			{
				id: "contacto",
				label: "Contacto",
				href: "/contacto",
				icon: "contact",
			},
		],
	},
	{
		label: "Sistema",
		items: [
			{
				id: "actividad",
				label: "Actividad",
				href: "/actividad",
				icon: "activity",
			},
			{ id: "estado", label: "Estado", href: "/estado", icon: "status" },
			{ id: "cuenta", label: "Cuenta", href: "/cuenta", icon: "account" },
		],
	},
];

export const findNavItem = (id: string): NavItem | undefined =>
	NAV.flatMap((group) => group.items).find((item) => item.id === id);

/**
 * A donde lleva "Volver": la ultima miga con enlace ANTES de la pagina actual. En una
 * pantalla de modulo (la lista) no hay nivel de arriba y devuelve `undefined`.
 */
export const backTarget = <T extends { label: string; href?: string }>(
	trail: readonly T[],
): (T & { href: string }) | undefined =>
	[...trail]
		.slice(0, -1)
		.reverse()
		.find((crumb): crumb is T & { href: string } => Boolean(crumb.href));
