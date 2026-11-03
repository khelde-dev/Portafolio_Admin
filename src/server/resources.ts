import type { ZodType } from "zod";
import { contactSchema } from "@/schemas/contact";
import {
	aboutSchema,
	educationSchema,
	experienceSchema,
	skillSchema,
} from "@/schemas/content";
import {
	commentStatusSchema,
	messageQuerySchema,
	messageStatusSchema,
} from "@/schemas/inbox";
import { projectSchema } from "@/schemas/projects";

/**
 * LISTA BLANCA de lo que el navegador puede pedirle al admin y de como se
 * traduce al backend. Todo lo que no este aqui es 404/405: denegar por defecto.
 * La clave es el segmento de `/api/<recurso>` y coincide con el del backend.
 */
export interface ResourceConfig {
	/** `GET` del backend que devuelve TODO (borradores y traducciones incluidos). */
	listPath: string;
	/** Base de las escrituras (`<base>`, `<base>/:id`, `<base>/order`). */
	basePath: string;
	/** Esquema del cuerpo de `POST`/`PUT`. */
	schema?: ZodType;
	/** Esquema del `?query` de la lista. */
	query?: ZodType;
	create?: boolean;
	update?: boolean;
	remove?: boolean;
	/** `PUT <base>/order` para reordenar en lote. */
	order?: boolean;
	/** Una sola fila (`id = 1`): `PUT <base>` sin id, sin crear ni borrar. */
	singleton?: boolean;
	/** Que campo repetido produce un 409 (para marcarlo en el formulario). */
	conflictField?: { path: string; message: string };
}

export const RESOURCES: Record<string, ResourceConfig> = {
	projects: {
		listPath: "/projects/admin",
		basePath: "/projects",
		schema: projectSchema,
		create: true,
		update: true,
		remove: true,
		order: true,
		conflictField: {
			path: "slug",
			message: "Ya existe un proyecto con ese slug",
		},
	},
	experiences: {
		listPath: "/experiences/admin",
		basePath: "/experiences",
		schema: experienceSchema,
		create: true,
		update: true,
		remove: true,
		order: true,
	},
	education: {
		listPath: "/education/admin",
		basePath: "/education",
		schema: educationSchema,
		create: true,
		update: true,
		remove: true,
		order: true,
	},
	skills: {
		listPath: "/skills/admin",
		basePath: "/skills",
		schema: skillSchema,
		create: true,
		update: true,
		remove: true,
		order: true,
	},
	about: {
		listPath: "/about/admin",
		basePath: "/about",
		schema: aboutSchema,
		update: true,
		singleton: true,
	},
	"contact-info": {
		listPath: "/contact-info/admin",
		basePath: "/contact-info",
		schema: contactSchema,
		update: true,
		singleton: true,
	},
	comments: {
		listPath: "/comments/admin",
		basePath: "/comments",
		schema: commentStatusSchema,
		update: true,
		// Borrado definitivo: el admin solo lo ofrece desde "Ocultos".
		remove: true,
	},
	"contact-messages": {
		listPath: "/contact-messages",
		basePath: "/contact-messages",
		schema: messageStatusSchema,
		query: messageQuerySchema,
		update: true,
		remove: true,
	},
};

/** `Object.hasOwn`: `__proto__` o `constructor` nunca son un recurso. */
export const findResource = (
	key: string | undefined,
): ResourceConfig | undefined =>
	key && Object.hasOwn(RESOURCES, key) ? RESOURCES[key] : undefined;
