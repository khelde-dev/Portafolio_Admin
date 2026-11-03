/**
 * Actividad: el historial de cambios que guarda el backend (`GET /audit`). Aqui
 * se traduce cada fila a una frase y, si el elemento sigue teniendo pantalla de
 * edicion, a un enlace.
 */
export type AuditAction = "create" | "update" | "delete";

export interface AuditEntry {
	id: number;
	at: string;
	admin_email: string;
	action: AuditAction;
	resource: string;
	resource_id: string;
	summary: string | null;
}

interface ResourceInfo {
	/** Nombre en singular, para "editó proyecto". */
	label: string;
	/** Pantalla de la lista. */
	list: string;
	/** Pantalla de un elemento; sin ella (fichas unicas) el enlace es la lista. */
	item?: (id: string) => string;
}

const RESOURCES: Record<string, ResourceInfo> = {
	projects: {
		label: "proyecto",
		list: "/proyectos",
		item: (id) => `/proyectos/${id}`,
	},
	experiences: {
		label: "experiencia",
		list: "/experiencia",
		item: (id) => `/experiencia/${id}`,
	},
	education: {
		label: "estudio",
		list: "/educacion",
		item: (id) => `/educacion/${id}`,
	},
	skills: {
		label: "habilidad",
		list: "/habilidades",
		item: (id) => `/habilidades/${id}`,
	},
	about: { label: "sobre mí", list: "/sobre-mi" },
	"contact-info": { label: "datos de contacto", list: "/contacto" },
	"site-copy": { label: "textos del sitio", list: "/textos" },
	comments: { label: "comentario", list: "/comentarios" },
	"contact-messages": { label: "mensaje", list: "/mensajes" },
	media: { label: "imagen", list: "/medios" },
};

export const RESOURCE_OPTIONS = Object.entries(RESOURCES).map(
	([value, info]) => ({ value, label: info.label }),
);

export const isKnownResource = (value: string | null | undefined): boolean =>
	Boolean(value && Object.hasOwn(RESOURCES, value));

const VERBS: Record<AuditAction, string> = {
	create: "creó",
	update: "editó",
	delete: "borró",
};

export interface ActivityLine {
	verb: string;
	label: string;
	/** Lo que se cambio, en una frase corta (puede faltar). */
	summary: string | null;
	/** A donde ir a verlo; `null` si ya no existe o no tiene pantalla. */
	href: string | null;
}

export const describeEntry = (entry: AuditEntry): ActivityLine => {
	const info = Object.hasOwn(RESOURCES, entry.resource)
		? RESOURCES[entry.resource]
		: null;
	const label = info?.label ?? entry.resource;
	// `PUT /<recurso>/order` se guarda como update de "order".
	const reorder = entry.action === "update" && entry.resource_id === "order";
	const verb = reorder ? "reordenó" : (VERBS[entry.action] ?? entry.action);

	let href: string | null = null;
	if (info && entry.action !== "delete") {
		if (reorder || !info.item) href = info.list;
		else if (/^\d+$/.test(entry.resource_id))
			href = info.item(entry.resource_id);
		else href = info.list;
	}
	return {
		verb,
		label: reorder ? `${label}s` : label,
		summary: entry.summary,
		href,
	};
};

/** Rechaza lo que no tenga la forma esperada: el backend es de confianza, pero esto se pinta. */
export const parseAudit = (data: unknown): AuditEntry[] => {
	if (!Array.isArray(data)) return [];
	return data.filter(
		(row): row is AuditEntry =>
			typeof row === "object" &&
			row !== null &&
			typeof (row as AuditEntry).id === "number" &&
			typeof (row as AuditEntry).at === "string" &&
			["create", "update", "delete"].includes((row as AuditEntry).action) &&
			typeof (row as AuditEntry).resource === "string" &&
			typeof (row as AuditEntry).resource_id === "string",
	);
};
