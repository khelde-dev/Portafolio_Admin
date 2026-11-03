import { zodResolver } from "@hookform/resolvers/zod";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
	type FieldValues,
	FormProvider,
	type Resolver,
	useForm,
} from "react-hook-form";
import toast from "react-hot-toast";
import type { ZodType } from "zod";
import { Alert, AlertAction, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiFailure } from "@/lib/apiClient";
import { issuesToFieldErrors } from "@/lib/formErrors";
import { cn } from "@/lib/utils";

interface Props<TValues extends FieldValues> {
	/** Esquema Zod: valida en el navegador con las mismas reglas que la ruta del servidor. */
	schema: ZodType;
	defaultValues: TValues;
	/** Recibe el valor YA validado y normalizado (p. ej. `translations` como lista). */
	onSubmit: (payload: Record<string, unknown>) => Promise<unknown>;
	children: ReactNode;
	submitLabel?: string;
	/** Aviso tras guardar; el mismo verbo que el boton ("Guardado"). */
	successMessage?: string;
	/** A donde vuelve "Cancelar". */
	cancelHref?: string;
	/** Se llama despues de guardar bien (p. ej. para ir a la lista). */
	onSaved?: (result: unknown) => void;
}

/**
 * Envoltura de TODOS los formularios de contenido: validacion, errores del
 * servidor en su campo, aviso de cambios sin guardar, `Ctrl/Cmd + S` y la barra
 * fija de guardar. Nada se guarda solo: se guarda al pulsar el boton.
 */
export function ResourceForm<TValues extends FieldValues>({
	schema,
	defaultValues,
	onSubmit,
	children,
	submitLabel = "Guardar cambios",
	successMessage = "Guardado",
	cancelHref,
	onSaved,
}: Props<TValues>) {
	const form = useForm<TValues>({
		resolver: zodResolver(schema as never) as unknown as Resolver<TValues>,
		defaultValues: defaultValues as never,
	});
	const {
		formState: { isDirty, isSubmitting, errors },
	} = form;
	const [formError, setFormError] = useState<string | null>(null);
	// Otra edicion guardo primero: el formulario ya no esta al dia.
	const [stale, setStale] = useState(false);

	const submit = useCallback(
		async (payload: unknown) => {
			setFormError(null);
			setStale(false);
			try {
				const result = await onSubmit(payload as Record<string, unknown>);
				toast.success(successMessage);
				// El backend devuelve la fila con su `updated_at` nuevo: con ese se guarda la
				// siguiente vez, o el segundo guardado de esta misma pestana daria 409.
				const next = (result as { updated_at?: unknown } | null)?.updated_at;
				if (typeof next === "string") {
					form.setValue("updated_at" as never, next as never);
				}
				form.reset(form.getValues());
				onSaved?.(result);
			} catch (error) {
				if (!(error instanceof ApiFailure)) {
					setFormError("No se pudo guardar. Intenta de nuevo.");
					return;
				}
				if (error.stale) {
					setStale(true);
					setFormError(error.message);
					return;
				}
				const sent = (payload as { translations?: { locale: string }[] })
					?.translations;
				const { fields, root } = issuesToFieldErrors(error.issues, sent);
				for (const { name, message } of fields) {
					form.setError(name as never, { type: "server", message });
				}
				const first = fields[0]?.name;
				if (first) form.setFocus(first as never);
				// Sin aviso por campo, el mensaje general del servidor va arriba.
				setFormError(
					root.length > 0 || fields.length === 0
						? [error.message, ...root].join(" ")
						: "Revisa los campos marcados.",
				);
			}
		},
		[form, onSaved, onSubmit, successMessage],
	);

	const handleSave = form.handleSubmit(submit as never);

	// Cambios sin guardar: avisa antes de cerrar o recargar la pestana.
	useEffect(() => {
		if (!isDirty || isSubmitting) return;
		const warn = (event: BeforeUnloadEvent) => {
			event.preventDefault();
		};
		window.addEventListener("beforeunload", warn);
		return () => window.removeEventListener("beforeunload", warn);
	}, [isDirty, isSubmitting]);

	// Ctrl/Cmd + S guarda.
	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
				event.preventDefault();
				void handleSave();
			}
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [handleSave]);

	const invalid = Object.keys(errors).length > 0;

	return (
		<FormProvider {...form}>
			<form onSubmit={handleSave} noValidate className="flex flex-col gap-10">
				{formError ? (
					<Alert variant="destructive" className={stale ? "pr-28" : undefined}>
						<AlertDescription>{formError}</AlertDescription>
						{stale ? (
							<AlertAction>
								<Button
									type="button"
									variant="outline"
									size="sm"
									onClick={() => window.location.reload()}
								>
									Recargar
								</Button>
							</AlertAction>
						) : null}
					</Alert>
				) : null}

				{children}

				<div className="sticky bottom-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
					<output
						className="eyebrow block min-h-5"
						data-state={isDirty ? "dirty" : "clean"}
					>
						{isSubmitting
							? "Guardando…"
							: invalid
								? "Hay campos por corregir"
								: isDirty
									? "Cambios sin guardar"
									: ""}
					</output>
					<div className="flex items-center gap-2">
						{cancelHref ? (
							<a
								href={cancelHref}
								className={cn(
									buttonVariants({ variant: "ghost" }),
									"min-h-11 px-4",
								)}
							>
								Cancelar
							</a>
						) : null}
						<Button
							type="submit"
							className="min-h-11 px-5"
							disabled={isSubmitting}
							aria-busy={isSubmitting}
						>
							{isSubmitting ? "Guardando…" : submitLabel}
						</Button>
					</div>
				</div>
			</form>
		</FormProvider>
	);
}
