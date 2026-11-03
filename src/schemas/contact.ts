import { z } from "zod";

/**
 * Datos de contacto del sitio (`contact_info`, una sola fila con id = 1). Mismas
 * reglas que el backend: aqui se avisa antes, alla se hace cumplir.
 */

/**
 * URL https de un dominio concreto (o de uno de sus subdominios). Un enlace de
 * "GitHub" que apunta a otro sitio, o con `javascript:`, acabaria en un `href`
 * publico: por eso se valida el dominio y no solo que sea una URL.
 */
const siteUrl = (domain: string, label: string) =>
	z
		.string({ error: `El enlace de ${label} es obligatorio` })
		.trim()
		.min(1, `El enlace de ${label} es obligatorio`)
		.max(300, `El enlace de ${label} es demasiado largo`)
		.refine((value) => {
			try {
				const url = new URL(value);
				return (
					url.protocol === "https:" &&
					(url.hostname === domain || url.hostname.endsWith(`.${domain}`))
				);
			} catch {
				return false;
			}
		}, `Escribe una URL https de ${domain}`);

export const phoneDigits = (phone: string): string => phone.replace(/\D/g, "");

/** Enlace de WhatsApp: no se guarda, se arma con el telefono. */
export const whatsappUrl = (phone: string): string =>
	`https://wa.me/${phoneDigits(phone)}`;

export const contactSchema = z.object({
	github_url: siteUrl("github.com", "GitHub"),
	linkedin_url: siteUrl("linkedin.com", "LinkedIn"),
	linkedin_name: z
		.string({ error: "El nombre de LinkedIn es obligatorio" })
		.trim()
		.min(1, "El nombre de LinkedIn es obligatorio")
		.max(100, "El nombre de LinkedIn admite hasta 100 caracteres"),
	phone: z
		.string({ error: "El teléfono es obligatorio" })
		.trim()
		.min(1, "El teléfono es obligatorio")
		.max(30, "El teléfono es demasiado largo")
		.regex(
			/^\+[\d\s().-]+$/,
			"Empieza con + y la lada del país, por ejemplo +52 55 1190 9105",
		)
		.refine((phone) => {
			const n = phoneDigits(phone).length;
			return n >= 8 && n <= 15;
		}, "El teléfono debe tener entre 8 y 15 dígitos"),
	email: z
		.string({ error: "El correo es obligatorio" })
		.trim()
		.toLowerCase()
		.min(1, "El correo es obligatorio")
		.max(254, "El correo es demasiado largo")
		.pipe(z.email("Escribe un correo válido")),
});
export type ContactInput = z.input<typeof contactSchema>;

export interface ContactRow {
	contact_id: number;
	github_url: string;
	linkedin_url: string;
	linkedin_name: string;
	phone: string;
	email: string;
	created_at: string;
	updated_at: string;
}
