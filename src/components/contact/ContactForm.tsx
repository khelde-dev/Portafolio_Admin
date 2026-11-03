import { useFormContext, useWatch } from "react-hook-form";
import { FormSection } from "@/components/form/FormSection";
import { TextField } from "@/components/form/fields";
import { ResourceForm } from "@/components/form/ResourceForm";
import { api } from "@/lib/apiClient";
import { contactValues } from "@/lib/contentForms";
import {
	type ContactRow,
	contactSchema,
	phoneDigits,
	whatsappUrl,
} from "@/schemas/contact";

/** Muestra a que numero de WhatsApp llevara el boton del sitio, segun el telefono escrito. */
const WhatsappPreview = () => {
	const { control } = useFormContext();
	const phone = useWatch({ control, name: "phone" }) as string | undefined;
	const ready = phoneDigits(phone ?? "").length >= 8;
	return (
		<p className="-mt-3 text-sm text-muted-foreground" aria-live="polite">
			{ready
				? `El botón de WhatsApp del sitio abrirá ${whatsappUrl(phone ?? "")}.`
				: "El botón de WhatsApp del sitio se arma con este teléfono."}
		</p>
	);
};

/**
 * Datos de contacto: UNA sola fila, no se crea ni se borra. Si todavia no
 * existe, guardar la crea (el backend hace un upsert).
 */
export const ContactForm = ({ initial }: { initial: ContactRow | null }) => (
	<ResourceForm
		schema={contactSchema}
		defaultValues={contactValues(initial)}
		successMessage="Guardado"
		onSubmit={(payload) => api.put("/api/contact-info", payload)}
	>
		<FormSection
			title="Redes"
			description="Los enlaces del encabezado, del pie y de la sección de contacto."
		>
			<TextField
				name="github_url"
				label="Perfil de GitHub"
				type="url"
				inputMode="url"
				required
				hint="Una URL https de github.com."
			/>
			<TextField
				name="linkedin_url"
				label="Perfil de LinkedIn"
				type="url"
				inputMode="url"
				required
				hint="Una URL https de linkedin.com."
			/>
			<TextField
				name="linkedin_name"
				label="Nombre que se ve junto a LinkedIn"
				required
				hint="Hasta 100 caracteres."
			/>
		</FormSection>

		<FormSection
			title="Teléfono y correo"
			description="No se traducen: son los mismos en español, inglés y francés."
		>
			<TextField
				name="phone"
				label="Teléfono"
				required
				placeholder="+52 55 1190 9105"
				hint="Con el signo + y la lada del país."
			/>
			<WhatsappPreview />
			<TextField
				name="email"
				label="Correo"
				type="email"
				inputMode="email"
				required
			/>
		</FormSection>
	</ResourceForm>
);
