/**
 * Fechas. D1 guarda `current_timestamp` como texto `YYYY-MM-DD HH:MM:SS` en
 * UTC (sin zona); el admin las muestra en la zona del navegador.
 */
const D1_TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/;

/** `2026-11-02 14:05:00` (UTC) -> Date. `null` si no es una fecha valida. */
export const parseD1Date = (value: string | null | undefined): Date | null => {
	if (!value) return null;
	const match = D1_TIMESTAMP.exec(value);
	const date = match
		? new Date(
				Date.UTC(
					+match[1],
					+match[2] - 1,
					+match[3],
					+match[4],
					+match[5],
					+match[6],
				),
			)
		: new Date(value);
	return Number.isNaN(date.getTime()) ? null : date;
};

const dateTime = new Intl.DateTimeFormat("es-MX", {
	day: "numeric",
	month: "short",
	year: "numeric",
	hour: "2-digit",
	minute: "2-digit",
});

/** `2 nov 2026, 14:05` en la zona del navegador; `—` si no hay fecha. */
export const formatDateTime = (
	value: string | Date | null | undefined,
): string => {
	const date = value instanceof Date ? value : parseD1Date(value);
	return date ? dateTime.format(date) : "—";
};

/** Segundos desde epoch (claim `exp` del JWT) -> Date. */
export const fromEpoch = (seconds: number): Date => new Date(seconds * 1000);
