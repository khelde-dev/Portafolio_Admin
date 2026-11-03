import { useEffect, useId, useRef } from "react";
import { Controller, get, useFormContext, useWatch } from "react-hook-form";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
	formatPeriod,
	MONTH_OPTIONS,
	PERIOD_MESSAGES,
	type PeriodValue,
	periodIssue,
	yearOptions,
} from "@/lib/period";

const selectClass =
	"min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none aria-invalid:border-destructive";

interface DateSelectsProps {
	prefix: "period.start" | "period.end";
	legend: string;
	invalid: boolean;
	describedBy?: string;
}

/** Mes (opcional) y año de una fecha. */
const DateSelects = ({
	prefix,
	legend,
	invalid,
	describedBy,
}: DateSelectsProps) => {
	const { register } = useFormContext();
	const monthId = useId();
	const yearId = useId();
	const years = yearOptions();
	return (
		<fieldset className="grid grid-cols-2 gap-3">
			<legend className="mb-1.5 text-[0.9375rem] font-medium">{legend}</legend>
			<div>
				<Label htmlFor={monthId} className="sr-only">
					Mes de {legend.toLowerCase()}
				</Label>
				<select
					id={monthId}
					className={selectClass}
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					{...register(`${prefix}Month`)}
				>
					<option value="">Mes (opcional)</option>
					{MONTH_OPTIONS.map((m) => (
						<option key={m.value} value={m.value}>
							{m.label}
						</option>
					))}
				</select>
			</div>
			<div>
				<Label htmlFor={yearId} className="sr-only">
					Año de {legend.toLowerCase()}
				</Label>
				<select
					id={yearId}
					className={selectClass}
					aria-invalid={invalid || undefined}
					aria-describedby={describedBy}
					{...register(`${prefix}Year`)}
				>
					<option value="">Año</option>
					{years.map((y) => (
						<option key={y.value} value={y.value}>
							{y.label}
						</option>
					))}
				</select>
			</div>
		</fieldset>
	);
};

/**
 * Periodo de una experiencia al estilo de LinkedIn: inicio, fin y un check
 * "Actualmente trabajo aquí". Escribe solo `time_default` y el periodo de EN y FR
 * (con «Actualidad / Present / Aujourd'hui»); `period` es estado del formulario y
 * el esquema no lo deja pasar.
 */
export const PeriodField = () => {
	const { control, setValue, formState } = useFormContext();
	const period = useWatch({ control, name: "period" }) as
		| PeriodValue
		| undefined;
	const id = useId();
	const errorId = `${id}-error`;
	const first = useRef(true);
	const formError = (
		get(formState.errors, "time_default") as { message?: string } | undefined
	)?.message;

	useEffect(() => {
		// Al abrir no se toca nada: un periodo guardado como texto libre se conserva.
		if (first.current) {
			first.current = false;
			return;
		}
		if (!period) return;
		const options = { shouldDirty: true, shouldValidate: Boolean(formError) };
		setValue("time_default", formatPeriod(period, "es"), options);
		setValue("translations.en.time", formatPeriod(period, "en"), options);
		setValue("translations.fr.time", formatPeriod(period, "fr"), options);
	}, [period, setValue, formError]);

	const issue = period ? periodIssue(period) : "start";
	const touched = formState.dirtyFields.period !== undefined;
	const message =
		touched || formError
			? issue
				? PERIOD_MESSAGES[issue]
				: formError
			: undefined;
	const saved = formState.defaultValues?.time_default as string | undefined;
	const unreadable =
		Boolean(saved) && !formState.defaultValues?.period?.startYear;

	return (
		<fieldset className="flex flex-col gap-4">
			<legend className="mb-1.5 text-[0.9375rem] font-medium">
				Periodo{" "}
				<span className="font-normal text-muted-foreground">(obligatorio)</span>
			</legend>
			<DateSelects
				prefix="period.start"
				legend="Inicio"
				invalid={issue === "start" && Boolean(message)}
				describedBy={message ? errorId : undefined}
			/>
			<Controller
				control={control}
				name="period.current"
				render={({ field }) => (
					<div className="flex items-center gap-3">
						<Checkbox
							id={`${id}-actual`}
							checked={Boolean(field.value)}
							onCheckedChange={field.onChange}
						/>
						<Label
							htmlFor={`${id}-actual`}
							className="text-[0.9375rem] font-normal"
						>
							Actualmente trabajo aquí
						</Label>
					</div>
				)}
			/>
			{period?.current ? null : (
				<DateSelects
					prefix="period.end"
					legend="Fin"
					invalid={(issue === "end" || issue === "order") && Boolean(message)}
					describedBy={message ? errorId : undefined}
				/>
			)}
			<p className="text-sm text-muted-foreground">
				{unreadable && !touched
					? `Periodo guardado: «${saved}». Elige las fechas para reemplazarlo.`
					: "El texto se escribe solo en español, inglés y francés."}
			</p>
			{message ? (
				<p
					id={errorId}
					role="alert"
					className="text-sm font-medium text-destructive"
				>
					{message}
				</p>
			) : null}
		</fieldset>
	);
};
