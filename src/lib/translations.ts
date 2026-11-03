/**
 * Traducciones del contenido. El backend las ENTREGA como mapa
 * (`{ en: {...}, fr: {...} }`) y las RECIBE como lista
 * (`[{ locale: "en", ... }]`, sin locale repetido). Este es el unico lugar del
 * admin que convierte entre ambas formas: un error aqui borra traducciones en
 * silencio, asi que tiene pruebas de ida y vuelta.
 *
 * El espanol (`*_default`) es la base y no es una traduccion: solo `en` y `fr`.
 */
export const LOCALES = ["es", "en", "fr"] as const;
export type Locale = (typeof LOCALES)[number];

export const TRANSLATED_LOCALES = ["en", "fr"] as const;
export type TranslatedLocale = (typeof TRANSLATED_LOCALES)[number];

export const LOCALE_LABELS: Record<Locale, string> = {
	es: "Español",
	en: "Inglés",
	fr: "Francés",
};

export type Fields = Record<string, string | null | undefined>;
export type TranslationMap = Partial<Record<TranslatedLocale, Fields>>;
export type TranslationEntry = { locale: Locale } & Fields;

/** Vacio = no hay nada que guardar (texto en blanco, `null` o ausente). */
export const isBlank = (value: unknown): boolean =>
	value === null ||
	value === undefined ||
	(typeof value === "string" && value.trim() === "");

/** Deja solo los campos con contenido (y recorta espacios). */
const compact = (fields: Fields | undefined): Fields => {
	const out: Fields = {};
	for (const [key, value] of Object.entries(fields ?? {})) {
		if (!isBlank(value))
			out[key] = typeof value === "string" ? value.trim() : value;
	}
	return out;
};

/**
 * Mapa -> lista para enviar. Una traduccion sin ningun campo se descarta (no se
 * manda `{ locale: "en" }` vacio) y solo salen los idiomas traducibles.
 */
export const toTranslationList = (
	map: TranslationMap | null | undefined,
): TranslationEntry[] =>
	TRANSLATED_LOCALES.flatMap((locale) => {
		const fields = compact(map?.[locale]);
		return Object.keys(fields).length > 0 ? [{ locale, ...fields }] : [];
	});

/** Lista -> mapa para editar. Si un idioma viene repetido gana el ultimo. */
export const toTranslationMap = (
	list: readonly TranslationEntry[] | null | undefined,
): TranslationMap => {
	const map: TranslationMap = {};
	for (const { locale, ...fields } of list ?? []) {
		if (locale === "en" || locale === "fr") map[locale] = fields;
	}
	return map;
};

/**
 * Lo que entrega el backend (mapa que puede traer `es`, campos `null` o claves
 * desconocidas) -> mapa limpio para el formulario: solo `en`/`fr` y solo los
 * campos que el formulario conoce.
 */
export const normalizeTranslations = (
	raw: unknown,
	fieldNames: readonly string[],
): TranslationMap => {
	const source = (raw && typeof raw === "object" ? raw : {}) as Record<
		string,
		unknown
	>;
	const map: TranslationMap = {};
	for (const locale of TRANSLATED_LOCALES) {
		const entry = source[locale];
		if (!entry || typeof entry !== "object") continue;
		const fields: Fields = {};
		for (const name of fieldNames) {
			const value = (entry as Record<string, unknown>)[name];
			if (typeof value === "string") fields[name] = value;
		}
		if (Object.keys(fields).length > 0) map[locale] = fields;
	}
	return map;
};

/** Estado de una pestana de idioma: para la marca "completa / incompleta / vacia". */
export type Completeness = "complete" | "partial" | "empty";

export const completeness = (
	fields: Fields | undefined,
	required: readonly string[],
): Completeness => {
	const filled = required.filter((name) => !isBlank(fields?.[name])).length;
	if (filled === 0) return "empty";
	return filled === required.length ? "complete" : "partial";
};
