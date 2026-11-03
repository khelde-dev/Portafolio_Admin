import type { ServerIssue } from "@/lib/apiClient";

export interface FieldError {
	/** Nombre del campo en `react-hook-form` (`slug`, `translations.fr.title`). */
	name: string;
	message: string;
}

/**
 * Avisos por campo del servidor -> nombres de campo del formulario.
 *
 * El servidor numera las traducciones por POSICION en la lista que se envio
 * (`translations.1.title`), pero el formulario las edita por IDIOMA
 * (`translations.fr.title`): se resuelve con la lista que se mando.
 * Un aviso sin ruta (o de un campo que el formulario no tiene) va a `root`.
 */
export const issuesToFieldErrors = (
	issues: readonly ServerIssue[],
	sentTranslations: readonly { locale: string }[] = [],
): { fields: FieldError[]; root: string[] } => {
	const fields: FieldError[] = [];
	const root: string[] = [];

	for (const { path, message } of issues) {
		if (path.length === 0) {
			root.push(message);
			continue;
		}
		const [head, index, ...rest] = path;
		if (head === "translations" && typeof index === "number") {
			const locale = sentTranslations[index]?.locale;
			if (locale && rest.length > 0) {
				fields.push({
					name: `translations.${locale}.${rest.join(".")}`,
					message,
				});
			} else {
				root.push(message);
			}
			continue;
		}
		fields.push({ name: path.join("."), message });
	}
	return { fields, root };
};
