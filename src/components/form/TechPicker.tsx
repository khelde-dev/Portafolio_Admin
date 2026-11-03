import { Plus, X } from "lucide-react";
import { useId, useState } from "react";
import { get, useFormContext } from "react-hook-form";
import { FieldShell } from "@/components/form/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	isValidTechName,
	KNOWN_TECHNOLOGIES,
	suggestTechnologies,
	techIconUrl,
	techStackUrl,
} from "@/lib/techIcons";

interface Props {
	/** Campo del formulario con la lista (`images_topics`). */
	name: string;
	label: string;
	hint?: string;
}

const Icon = ({ name, className }: { name: string; className?: string }) => (
	<img
		src={techIconUrl(name)}
		alt=""
		width={24}
		height={24}
		loading="lazy"
		className={className ?? "size-6"}
	/>
);

/**
 * Selector de tecnologias: las elegidas como etiquetas con su icono, un buscador
 * con sugerencias y "Agregar otra" para un nombre nuevo, con vista previa del
 * icono para comprobar que existe antes de guardarlo.
 */
export const TechPicker = ({ name, label, hint }: Props) => {
	const { watch, setValue, formState } = useFormContext();
	const [query, setQuery] = useState("");
	const searchId = useId();
	const listId = `${searchId}-lista`;
	const selected = ((watch(name) as string[] | undefined) ?? []).filter(
		Boolean,
	);
	const error = (
		get(formState.errors, name) as { message?: string } | undefined
	)?.message;

	const set = (next: string[]) =>
		setValue(name, next, { shouldDirty: true, shouldValidate: true });
	const add = (tech: string) => {
		if (!selected.includes(tech)) set([...selected, tech]);
		setQuery("");
	};

	const suggestions = suggestTechnologies(query, selected);
	const custom = query.trim().toLowerCase();
	const canAddCustom =
		custom !== "" &&
		isValidTechName(custom) &&
		!selected.includes(custom) &&
		!(KNOWN_TECHNOLOGIES as readonly string[]).includes(custom);

	return (
		<FieldShell id={searchId} label={label} hint={hint} error={error}>
			{selected.length > 0 ? (
				<ul aria-label={`${label} elegidas`} className="flex flex-wrap gap-2">
					{selected.map((tech) => (
						<li
							key={tech}
							className="inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-1 pl-3 text-sm font-medium"
						>
							<Icon name={tech} className="size-5" />
							{tech}
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={() => set(selected.filter((t) => t !== tech))}
								aria-label={`Quitar ${tech}`}
								className="size-8 rounded-full"
							>
								<X aria-hidden="true" className="size-4" />
							</Button>
						</li>
					))}
				</ul>
			) : (
				<p className="text-muted-foreground">
					Todavía no hay tecnologías elegidas.
				</p>
			)}

			{selected.length > 0 ? (
				<figure className="flex flex-col gap-1.5">
					{/* Una sola peticion para todo el conjunto: asi se ve junto. */}
					<img
						src={techStackUrl(selected)}
						alt={`Vista previa: ${selected.join(", ")}`}
						height={48}
						className="h-12 w-auto max-w-full self-start"
					/>
					<figcaption className="eyebrow">Vista previa del conjunto</figcaption>
				</figure>
			) : null}

			<Input
				id={searchId}
				type="search"
				value={query}
				onChange={(event) => setQuery(event.target.value)}
				placeholder="Buscar: react, node, tailwind…"
				aria-controls={listId}
				autoComplete="off"
				className="min-h-11 max-w-sm"
			/>

			<ul id={listId} aria-label="Sugerencias" className="flex flex-wrap gap-2">
				{suggestions.map((tech) => (
					<li key={tech}>
						<Button
							type="button"
							variant="outline"
							size="sm"
							className="min-h-10 gap-2 px-3"
							onClick={() => add(tech)}
						>
							<Icon name={tech} className="size-5" />
							{tech}
						</Button>
					</li>
				))}
				{suggestions.length === 0 && !canAddCustom ? (
					<li className="text-sm text-muted-foreground">
						{custom !== "" && !isValidTechName(custom)
							? "Usa minúsculas, números y . _ + - (hasta 40 caracteres)."
							: "No hay más sugerencias."}
					</li>
				) : null}
				{canAddCustom ? (
					<li>
						<Button
							type="button"
							variant="secondary"
							size="sm"
							className="min-h-10 gap-2 px-3"
							onClick={() => add(custom)}
						>
							<Plus aria-hidden="true" className="size-4" />
							Agregar otra: {custom}
							<Icon name={custom} className="size-5" />
						</Button>
						<p className="mt-1 text-sm text-muted-foreground">
							Mira que el icono aparezca; si sale roto, ese nombre no existe en
							el servicio.
						</p>
					</li>
				) : null}
			</ul>
		</FieldShell>
	);
};
