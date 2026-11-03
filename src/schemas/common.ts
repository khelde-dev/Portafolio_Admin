import { z } from "zod";
import {
	isBlank,
	TRANSLATED_LOCALES,
	type TranslationEntry,
	toTranslationList,
} from "@/lib/translations";

/**
 * Piezas comunes de los esquemas. Replican las reglas de
 * Backend_Portafolio/src/schemas (mismos limites y mensajes en espanol): el
 * backend es la defensa que cuenta; estos sirven para el formulario y para
 * cortar en la ruta del admin lo invalido antes de llamarlo.
 * tests/contracts/ comprueba que las dos copias no se separen.
 */

/** Texto obligatorio, recortado. */
export const requiredText = (label: string, max = 5000) =>
	z
		.string({ error: `${label} es obligatorio` })
		.trim()
		.min(1, `${label} es obligatorio`)
		.max(max, `${label} admite hasta ${max} caracteres`);

/** `z.url()` deja pasar `javascript:` o `data:`: solo http(s). */
export const httpUrl = (
	message = "Escribe una URL que empiece con http:// o https://",
) => z.url({ protocol: /^https?$/, error: message });

/** URL opcional: vacio = `null`. */
export const optionalUrl = z
	.union([z.literal(""), httpUrl(), z.null()])
	.optional()
	.transform((value) => (value ? value : null));

const BACKSLASH = String.fromCharCode(92);
const hasTraversal = (key: string) =>
	key.split("/").some((segment) => segment === ".." || segment === ".");
const hasControlChars = (key: string) =>
	[...key].some((ch) => {
		const code = ch.charCodeAt(0);
		return code < 0x20 || code === 0x7f;
	});

/**
 * Clave de objeto en R2 (`projects/abc.webp`; las heredadas como `/UPVM.webp`
 * siguen siendo validas). Sin `..`, sin esquema, sin `//` inicial, sin `\`.
 */
export const r2Key = (label = "La imagen") =>
	z
		.string({ error: `${label} es obligatoria` })
		.min(1, `${label} es obligatoria`)
		.max(512, "La clave de la imagen es demasiado larga")
		.refine(
			(key) =>
				!key.startsWith("//") &&
				!key.includes(BACKSLASH) &&
				!key.includes(":") &&
				!hasTraversal(key) &&
				!hasControlChars(key),
			"La clave de la imagen no es válida",
		);

export const slug = z
	.string({ error: "El slug es obligatorio" })
	.trim()
	.min(1, "El slug es obligatorio")
	.max(100, "El slug admite hasta 100 caracteres")
	.regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones");

export const sortOrder = z
	.number({ error: "El orden debe ser un número" })
	.int()
	.default(0);

export const resourceId = z
	.string()
	.regex(/^[1-9][0-9]{0,14}$/, "Identificador no válido")
	.transform(Number);

/** Etiquetas (stack / tecnologias): sin repetidos ni vacias. */
export const topics = z
	.array(z.string().trim().min(1).max(60))
	.max(60, "Demasiadas etiquetas")
	.default([])
	.refine(
		(list) => new Set(list).size === list.length,
		"Hay etiquetas repetidas",
	);

type FieldLimits = Record<string, number>;

/**
 * Campo `translations` de un formulario. ACEPTA el mapa del formulario
 * (`{ en: {title:"…"}, fr: {…} }`) o la lista que manda el navegador a la ruta
 * del admin, y SIEMPRE entrega la lista que el backend espera: sin campos
 * vacios, sin idiomas vacios y sin locale repetido.
 */
export const translationsField = (limits: FieldLimits) => {
	const text = (max: number) =>
		z.string().trim().max(max, `Admite hasta ${max} caracteres`);
	const optional = (max: number) => z.union([text(max), z.null()]).optional();
	const shape = Object.fromEntries(
		Object.entries(limits).map(([name, max]) => [name, optional(max)]),
	);

	const mapSchema = z.object(
		Object.fromEntries(
			TRANSLATED_LOCALES.map((l) => [l, z.object(shape).optional()]),
		),
	);
	const listSchema = z.array(
		z.object({ locale: z.enum(TRANSLATED_LOCALES), ...shape }),
	);

	return z
		.union([listSchema, mapSchema])
		.optional()
		.transform((value): TranslationEntry[] => {
			if (!value) return [];
			if (Array.isArray(value)) {
				// Lista: se limpia igual que el mapa (campos vacios fuera).
				const map = Object.fromEntries(
					value.map(({ locale, ...fields }) => [locale, fields]),
				);
				return toTranslationList(map);
			}
			return toTranslationList(
				value as Parameters<typeof toTranslationList>[0],
			);
		});
};

export { isBlank };
