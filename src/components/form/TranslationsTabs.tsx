import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import type { ReactNode } from "react";
import { get, useFormContext, useWatch } from "react-hook-form";
import { TextareaField, TextField } from "@/components/form/fields";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useUrlParam } from "@/hooks/useUrlParams";
import {
	type Completeness,
	completeness,
	LOCALE_LABELS,
	TRANSLATED_LOCALES,
	type TranslatedLocale,
} from "@/lib/translations";

export interface TranslatableField {
	/** Clave dentro de la traduccion (`title`, `summary`…). */
	name: string;
	label: string;
	multiline?: boolean;
	rows?: number;
	/** Campo del formulario con el valor en espanol (se muestra como referencia). */
	baseName: string;
	/** Hace falta para dar la traduccion por completa. */
	required?: boolean;
}

interface Props {
	/** Contenido de la pestana de espanol (la base: lo que no se traduce cae aqui). */
	spanish: ReactNode;
	fields: readonly TranslatableField[];
}

const MARKS: Record<Completeness, { label: string; icon: typeof Circle }> = {
	complete: { label: "completo", icon: CheckCircle2 },
	partial: { label: "incompleto", icon: CircleDot },
	empty: { label: "vacío", icon: Circle },
};

/** Idioma arriba y su estado debajo en movil; en una sola linea desde `sm`. */
const TRIGGER =
	"min-h-11 flex-col gap-0 px-2 py-1.5 sm:flex-row sm:gap-1.5 sm:px-4";

/**
 * Pestanas ES / EN / FR. El espanol es la base y es obligatorio; EN y FR son
 * opcionales y, lo que falte, cae al espanol en el sitio. Cada pestana dice si
 * esta completa con ICONO y PALABRA (nunca solo color).
 */
export const TranslationsTabs = ({ spanish, fields }: Props) => {
	const { control, formState } = useFormContext();
	const values = useWatch({ control, name: "translations" }) as
		| Partial<Record<TranslatedLocale, Record<string, string>>>
		| undefined;
	// El idioma que se esta editando vive en la URL (?idioma=en).
	const [localeRaw, setLocale] = useUrlParam("idioma", "es");
	const locale =
		localeRaw === "es" ||
		(TRANSLATED_LOCALES as readonly string[]).includes(localeRaw)
			? localeRaw
			: "es";
	const required = fields
		.filter((f) => f.required !== false)
		.map((f) => f.name);

	return (
		<Tabs
			value={locale}
			onValueChange={(value) => setLocale(value as string, { push: true })}
			className="gap-5"
		>
			<TabsList
				variant="line"
				aria-label="Idioma del contenido"
				// En movil son tres columnas iguales.
				className="w-full"
			>
				<TabsTrigger value="es" className={TRIGGER}>
					{LOCALE_LABELS.es}
					<span className="eyebrow sm:ml-2">base</span>
				</TabsTrigger>
				{TRANSLATED_LOCALES.map((locale) => {
					const state = completeness(values?.[locale], required);
					const { label, icon: Icon } = MARKS[state];
					const hasError = Boolean(
						get(formState.errors, `translations.${locale}`),
					);
					return (
						<TabsTrigger key={locale} value={locale} className={TRIGGER}>
							{LOCALE_LABELS[locale]}
							<span className="eyebrow inline-flex items-center gap-1 sm:ml-2">
								<Icon aria-hidden="true" className="size-3.5" />
								{hasError ? "revisar" : label}
							</span>
						</TabsTrigger>
					);
				})}
			</TabsList>

			<TabsContent value="es" className="flex flex-col gap-6">
				{spanish}
			</TabsContent>

			{TRANSLATED_LOCALES.map((locale) => (
				<TabsContent
					key={locale}
					value={locale}
					className="flex flex-col gap-6"
				>
					<p className="max-w-[62ch] text-muted-foreground">
						Opcional. Lo que dejes vacío se mostrará en español.
					</p>
					{fields.map((field) => (
						<TranslationField key={field.name} locale={locale} field={field} />
					))}
				</TabsContent>
			))}
		</Tabs>
	);
};

/** Valor actual del campo en espanol, como referencia bajo cada traduccion. */
const useBaseValue = (name: string): string => {
	const { control } = useFormContext();
	const value = useWatch({ control, name });
	return typeof value === "string" ? value : "";
};

/** Un campo de una traduccion, con el texto en espanol como referencia. */
const TranslationField = ({
	locale,
	field,
}: {
	locale: TranslatedLocale;
	field: TranslatableField;
}) => {
	const base = useBaseValue(field.baseName);
	const props = {
		name: `translations.${locale}.${field.name}`,
		label: field.label,
		hint: base ? (
			<>
				<span className="eyebrow">Español: </span>
				<span className="line-clamp-2">{base}</span>
			</>
		) : undefined,
	};
	return field.multiline ? (
		<TextareaField {...props} rows={field.rows ?? 5} />
	) : (
		<TextField {...props} />
	);
};
