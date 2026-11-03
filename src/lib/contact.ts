/**
 * Enlaces armados con datos de VISITANTES (correo, telefono). Esos valores
 * llegan del formulario publico, asi que nunca se pegan tal cual en un `href`:
 * un correo puede contener `?` o `&` (el formato de correo los permite) y
 * colar `?bcc=…` en un `mailto:`.
 */

/** `mailto:` con la direccion codificada y el asunto como unico parametro. */
export const mailtoHref = (email: string, subject?: string): string => {
	const address = encodeURIComponent(email.trim());
	return subject
		? `mailto:${address}?subject=${encodeURIComponent(subject)}`
		: `mailto:${address}`;
};

/** Solo digitos y un `+` inicial: `+52 (55) 1234-5678` -> `+525512345678`. */
export const phoneDigits = (phone: string): string => {
	const trimmed = phone.trim();
	const digits = trimmed.replace(/\D/g, "");
	return trimmed.startsWith("+") ? `+${digits}` : digits;
};

export const telHref = (phone: string): string | null => {
	const value = phoneDigits(phone);
	return value.replace("+", "").length >= 7 ? `tel:${value}` : null;
};

/** `https://wa.me/<digitos>`: wa.me no admite el `+`. */
export const whatsappHref = (phone: string): string | null => {
	const digits = phoneDigits(phone).replace("+", "");
	return digits.length >= 7 && digits.length <= 15
		? `https://wa.me/${digits}`
		: null;
};

/** Primera linea de un texto, recortada, para la vista previa de una fila. */
export const snippet = (text: string | null | undefined, max = 90): string => {
	const line = (text ?? "").replace(/\s+/g, " ").trim();
	return line.length > max ? `${line.slice(0, max - 1)}…` : line;
};
