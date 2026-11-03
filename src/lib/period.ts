/**
 * Periodo de una experiencia ("Ene 2023 - Actualidad"). La base guarda texto, no
 * fechas: aqui se arma ese texto a partir de mes y año, en cada idioma, y se lee
 * el que ya existe para rellenar el formulario al editar.
 */
export type PeriodLocale = "es" | "en" | "fr";

export interface PeriodValue {
	startMonth: string;
	startYear: string;
	endMonth: string;
	endYear: string;
	current: boolean;
}

export const emptyPeriod = (): PeriodValue => ({
	startMonth: "",
	startYear: "",
	endMonth: "",
	endYear: "",
	current: false,
});

const MONTHS: Record<PeriodLocale, readonly string[]> = {
	es: [
		"Ene",
		"Feb",
		"Mar",
		"Abr",
		"May",
		"Jun",
		"Jul",
		"Ago",
		"Sep",
		"Oct",
		"Nov",
		"Dic",
	],
	en: [
		"Jan",
		"Feb",
		"Mar",
		"Apr",
		"May",
		"Jun",
		"Jul",
		"Aug",
		"Sep",
		"Oct",
		"Nov",
		"Dec",
	],
	fr: [
		"janv.",
		"févr.",
		"mars",
		"avr.",
		"mai",
		"juin",
		"juil.",
		"août",
		"sept.",
		"oct.",
		"nov.",
		"déc.",
	],
};

const PRESENT: Record<PeriodLocale, string> = {
	es: "Actualidad",
	en: "Present",
	fr: "Aujourd'hui",
};

/** Opciones del <select> de mes: el valor es 1-12 y la etiqueta, el mes en español. */
export const MONTH_OPTIONS = MONTHS.es.map((label, index) => ({
	value: String(index + 1),
	label,
}));

/** De este año hacia atrás: nadie empieza un trabajo en el futuro. */
export const yearOptions = (
	now = new Date().getFullYear(),
	from = 1990,
): { value: string; label: string }[] =>
	Array.from({ length: Math.max(now - from + 1, 1) }, (_, i) => {
		const year = String(now - i);
		return { value: year, label: year };
	});

const monthText = (month: string, locale: PeriodLocale): string =>
	MONTHS[locale][Number(month) - 1] ?? "";

const date = (month: string, year: string, locale: PeriodLocale): string =>
	[monthText(month, locale), year].filter(Boolean).join(" ");

/** Numero comparable (año*12 + mes); sin mes cuenta como enero. */
const ordinal = (month: string, year: string): number =>
	Number(year) * 12 + (Number(month) || 1) - 1;

export type PeriodIssue = "start" | "end" | "order";

/** Que falta o esta mal; `null` cuando el periodo se puede guardar. */
export const periodIssue = (p: PeriodValue): PeriodIssue | null => {
	if (!p.startYear) return "start";
	if (p.current) return null;
	if (!p.endYear) return "end";
	return ordinal(p.endMonth, p.endYear) < ordinal(p.startMonth, p.startYear)
		? "order"
		: null;
};

export const PERIOD_MESSAGES: Record<PeriodIssue, string> = {
	start: "Indica el año de inicio",
	end: "Indica cuándo terminó o marca que sigue aquí",
	order: "La fecha de fin no puede ser anterior al inicio",
};

/** El texto del periodo en un idioma, o `""` si aun no esta completo. */
export const formatPeriod = (p: PeriodValue, locale: PeriodLocale): string => {
	if (periodIssue(p)) return "";
	const start = date(p.startMonth, p.startYear, locale);
	const end = p.current ? PRESENT[locale] : date(p.endMonth, p.endYear, locale);
	return `${start} - ${end}`;
};

const monthIndex = (token: string): string => {
	const clean = token.toLowerCase().replace(/\.$/, "");
	for (const list of Object.values(MONTHS)) {
		const found = list.findIndex(
			(m) => m.toLowerCase().replace(/\.$/, "") === clean,
		);
		if (found >= 0) return String(found + 1);
	}
	return clean === "sept" || clean === "set" ? "9" : "";
};

const PRESENT_WORDS =
	/^(actualidad|actualmente|presente|hoy|present|now|aujourd.?hui)$/i;

const PART = /^(?:([\p{L}]+\.?)\s+)?(\d{4})$/u;

/** Lee un texto guardado ("2023 - Actualidad", "Jan 2020 - Mar 2022"); `null` si no se entiende. */
export const parsePeriod = (
	text: string | null | undefined,
): PeriodValue | null => {
	if (!text) return null;
	const [from, to, ...rest] = text.split(/\s+[-–—]\s+/);
	if (!from || !to || rest.length > 0) return null;
	const start = from.trim().match(PART);
	if (!start) return null;
	const value = emptyPeriod();
	value.startMonth = start[1] ? monthIndex(start[1]) : "";
	if (start[1] && !value.startMonth) return null;
	value.startYear = start[2];
	if (PRESENT_WORDS.test(to.trim())) {
		value.current = true;
		return value;
	}
	const end = to.trim().match(PART);
	if (!end) return null;
	value.endMonth = end[1] ? monthIndex(end[1]) : "";
	if (end[1] && !value.endMonth) return null;
	value.endYear = end[2];
	return value;
};
