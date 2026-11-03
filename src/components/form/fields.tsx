import type { ReactNode } from "react";
import { Controller, get, useFormContext } from "react-hook-form";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

/** Ids del texto de ayuda y del error de un campo (para `aria-describedby`). */
export const fieldIds = (id: string) => ({
	hint: `${id}-hint`,
	error: `${id}-error`,
});

interface FieldShellProps {
	id: string;
	label: ReactNode;
	hint?: ReactNode;
	error?: string;
	required?: boolean;
	className?: string;
	children: ReactNode;
}

/**
 * Etiqueta VISIBLE + control + ayuda + error. El error se asocia con
 * `aria-describedby` en el control (lo hacen los campos de abajo) y se anuncia
 * con `role="alert"`; nada depende solo del color.
 */
export const FieldShell = ({
	id,
	label,
	hint,
	error,
	required,
	className,
	children,
}: FieldShellProps) => {
	const ids = fieldIds(id);
	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			<Label htmlFor={id} className="text-[0.9375rem] font-medium">
				{label}
				{required ? (
					<span className="text-muted-foreground font-normal">
						{" "}
						(obligatorio)
					</span>
				) : null}
			</Label>
			{children}
			{hint ? (
				<p id={ids.hint} className="text-sm text-muted-foreground">
					{hint}
				</p>
			) : null}
			{error ? (
				<p
					id={ids.error}
					role="alert"
					className="text-sm font-medium text-destructive"
				>
					{error}
				</p>
			) : null}
		</div>
	);
};

const describedBy = (id: string, hint: boolean, error: boolean) =>
	[hint ? fieldIds(id).hint : null, error ? fieldIds(id).error : null]
		.filter(Boolean)
		.join(" ") || undefined;

interface BaseFieldProps {
	/** Nombre en `react-hook-form` (`slug`, `translations.en.title`). */
	name: string;
	label: ReactNode;
	hint?: ReactNode;
	required?: boolean;
	className?: string;
}

const useFieldError = (name: string): string | undefined => {
	const { formState } = useFormContext();
	const error = get(formState.errors, name) as { message?: string } | undefined;
	return error?.message;
};

const domId = (name: string) => `campo-${name.replaceAll(".", "-")}`;

export const TextField = ({
	name,
	placeholder,
	type = "text",
	inputMode,
	...shell
}: BaseFieldProps & {
	placeholder?: string;
	type?: "text" | "url" | "email" | "number";
	inputMode?: "text" | "numeric" | "url" | "email";
}) => {
	const { register } = useFormContext();
	const error = useFieldError(name);
	const id = domId(name);
	return (
		<FieldShell id={id} error={error} {...shell}>
			<Input
				id={id}
				type={type}
				inputMode={inputMode}
				placeholder={placeholder}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy(id, Boolean(shell.hint), Boolean(error))}
				className="min-h-11"
				{...register(
					name,
					type === "number" ? { valueAsNumber: true } : undefined,
				)}
			/>
		</FieldShell>
	);
};

export const TextareaField = ({
	name,
	rows = 5,
	placeholder,
	...shell
}: BaseFieldProps & { rows?: number; placeholder?: string }) => {
	const { register } = useFormContext();
	const error = useFieldError(name);
	const id = domId(name);
	return (
		<FieldShell id={id} error={error} {...shell}>
			<Textarea
				id={id}
				rows={rows}
				placeholder={placeholder}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy(id, Boolean(shell.hint), Boolean(error))}
				{...register(name)}
			/>
		</FieldShell>
	);
};

export const SelectField = ({
	name,
	options,
	placeholder = "Elige una opción",
	...shell
}: BaseFieldProps & {
	options: readonly { value: string; label: string }[];
	placeholder?: string;
}) => {
	const { register } = useFormContext();
	const error = useFieldError(name);
	const id = domId(name);
	return (
		// Un <select> nativo: teclado, lectores de pantalla y movil resueltos.
		<FieldShell id={id} error={error} {...shell}>
			<select
				id={id}
				aria-invalid={error ? true : undefined}
				aria-describedby={describedBy(id, Boolean(shell.hint), Boolean(error))}
				className="min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-invalid:border-destructive"
				{...register(name)}
			>
				<option value="">{placeholder}</option>
				{options.map((o) => (
					<option key={o.value} value={o.value}>
						{o.label}
					</option>
				))}
			</select>
		</FieldShell>
	);
};

/** Interruptor con su etiqueta y una descripcion de lo que activa. */
export const ToggleField = ({
	name,
	label,
	hint,
	className,
}: Omit<BaseFieldProps, "required">) => {
	const { control } = useFormContext();
	const id = domId(name);
	return (
		<Controller
			control={control}
			name={name}
			render={({ field }) => (
				<div
					className={cn("flex items-start justify-between gap-4", className)}
				>
					<div className="min-w-0">
						<Label htmlFor={id} className="text-[0.9375rem] font-medium">
							{label}
						</Label>
						{hint ? (
							<p
								id={fieldIds(id).hint}
								className="text-sm text-muted-foreground"
							>
								{hint}
							</p>
						) : null}
					</div>
					<Switch
						id={id}
						checked={Boolean(field.value)}
						onCheckedChange={field.onChange}
						aria-describedby={hint ? fieldIds(id).hint : undefined}
					/>
				</div>
			)}
		/>
	);
};
