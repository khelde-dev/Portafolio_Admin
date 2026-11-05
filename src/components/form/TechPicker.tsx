import {
	type Announcements,
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	type ScreenReaderInstructions,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import { restrictToParentElement } from "@dnd-kit/modifiers";
import {
	rectSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
	Check,
	ChevronLeft,
	ChevronRight,
	ChevronsLeft,
	ChevronsRight,
	GripVertical,
	Plus,
	X,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { get, useFormContext } from "react-hook-form";
import { FieldShell } from "@/components/form/fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { moveItem } from "@/hooks/useReorder";
import {
	isValidTechName,
	KNOWN_TECHNOLOGIES,
	suggestTechnologies,
	techIconUrl,
	techStackUrl,
} from "@/lib/techIcons";
import { cn } from "@/lib/utils";

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

const INSTRUCTIONS: ScreenReaderInstructions = {
	draggable:
		"Para mover esta tecnología, pulsa la barra espaciadora para tomarla, las flechas para cambiarla de lugar y la barra espaciadora otra vez para soltarla. Escape cancela.",
};

/** El aviso del lector dice la posicion dentro de la lista, no un indice interno. */
const announcementsFor = (items: readonly string[]): Announcements => {
	const place = (id: string | number) => ({
		name: String(id),
		position: items.indexOf(String(id)) + 1,
		total: items.length,
	});
	return {
		onDragStart: ({ active }) => {
			const { name, position, total } = place(active.id);
			return `Tomaste ${name}, posición ${position} de ${total}.`;
		},
		onDragOver: ({ active, over }) => {
			if (!over) return undefined;
			return `${place(active.id).name} está sobre la posición ${place(over.id).position} de ${items.length}.`;
		},
		onDragEnd: ({ active, over }) => {
			const { name, total } = place(active.id);
			const target = over ? place(over.id).position : place(active.id).position;
			return `${name} quedó en la posición ${target} de ${total}.`;
		},
		onDragCancel: ({ active }) => {
			const { name, position, total } = place(active.id);
			return `Cancelado. ${name} sigue en la posición ${position} de ${total}.`;
		},
	};
};

/** `true` si la persona pidio menos movimiento: el reacomodo deja de animarse. */
const useReducedMotion = () => {
	const [reduced, setReduced] = useState(false);
	useEffect(() => {
		const query = window.matchMedia("(prefers-reduced-motion: reduce)");
		const sync = () => setReduced(query.matches);
		sync();
		query.addEventListener("change", sync);
		return () => query.removeEventListener("change", sync);
	}, []);
	return reduced;
};

interface PillProps {
	tech: string;
	index: number;
	count: number;
	moving: boolean;
	reducedMotion: boolean;
	onToggleMove: () => void;
	onRemove: () => void;
}

/** Una tecnologia elegida: asa para arrastrar, nombre para moverla con botones y quitar. */
const Pill = ({
	tech,
	index,
	count,
	moving,
	reducedMotion,
	onToggleMove,
	onRemove,
}: PillProps) => {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: tech });

	return (
		<li
			ref={setNodeRef}
			style={{
				transform: CSS.Translate.toString(transform),
				transition: reducedMotion ? undefined : transition,
			}}
			className={cn(
				"relative inline-flex items-center rounded-full border bg-card py-1 pr-1 pl-1 text-sm font-medium",
				isDragging
					? "z-10 border-primary shadow-[var(--glow-soft)]"
					: moving
						? "border-primary"
						: "border-border",
			)}
		>
			<button
				type="button"
				ref={setActivatorNodeRef}
				{...attributes}
				{...listeners}
				aria-label={`Arrastrar ${tech}, posición ${index + 1} de ${count}`}
				className="inline-flex size-8 shrink-0 cursor-grab touch-none items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary active:cursor-grabbing"
			>
				<GripVertical aria-hidden="true" className="size-4" />
			</button>
			<button
				type="button"
				onClick={onToggleMove}
				aria-pressed={moving}
				aria-label={`${tech}: elegir para moverla con botones`}
				className="inline-flex min-h-8 items-center gap-2 rounded-full px-1 focus-visible:outline-2 focus-visible:outline-primary"
			>
				<Icon name={tech} className="size-5" />
				{tech}
			</button>
			<Button
				type="button"
				variant="ghost"
				size="icon"
				onClick={onRemove}
				aria-label={`Quitar ${tech}`}
				className="size-8 rounded-full"
			>
				<X aria-hidden="true" className="size-4" />
			</Button>
		</li>
	);
};

/**
 * Selector de tecnologias: las elegidas como etiquetas con su icono que se REORDENAN
 * (arrastrando el asa, con el teclado o con los botones de "Mover"), un buscador con
 * sugerencias y "Agregar otra" para un nombre nuevo, con vista previa del icono.
 *
 * El orden importa: es el orden de los iconos en la tarjeta del proyecto. Al agregar
 * una tecnologia queda elegida para moverla, asi que se coloca donde va sin quitar
 * ninguna otra.
 */
export const TechPicker = ({ name, label, hint }: Props) => {
	const { watch, setValue, formState } = useFormContext();
	const [query, setQuery] = useState("");
	const [moving, setMoving] = useState<string | null>(null);
	const reducedMotion = useReducedMotion();
	const searchId = useId();
	const listId = `${searchId}-lista`;
	const contextId = useId();
	const selected = ((watch(name) as string[] | undefined) ?? []).filter(
		Boolean,
	);
	const error = (
		get(formState.errors, name) as { message?: string } | undefined
	)?.message;

	const sensors = useSensors(
		// 6 px de recorrido antes de empezar: un toque o clic en el asa no arrastra.
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const set = (next: string[]) =>
		setValue(name, next, { shouldDirty: true, shouldValidate: true });
	const add = (tech: string) => {
		if (!selected.includes(tech)) {
			set([...selected, tech]);
			// La recien agregada queda lista para colocarla en su lugar.
			setMoving(tech);
		}
		setQuery("");
	};
	const remove = (tech: string) => {
		set(selected.filter((t) => t !== tech));
		if (moving === tech) setMoving(null);
	};
	const moveTo = (tech: string, to: number) => {
		const from = selected.indexOf(tech);
		if (from >= 0 && to >= 0 && to < selected.length && from !== to) {
			set(moveItem(selected, from, to));
		}
	};

	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		const from = selected.indexOf(String(active.id));
		const to = selected.indexOf(String(over.id));
		if (from >= 0 && to >= 0) set(moveItem(selected, from, to));
	};

	const suggestions = suggestTechnologies(query, selected);
	const custom = query.trim().toLowerCase();
	const canAddCustom =
		custom !== "" &&
		isValidTechName(custom) &&
		!selected.includes(custom) &&
		!(KNOWN_TECHNOLOGIES as readonly string[]).includes(custom);

	const movingIndex = moving ? selected.indexOf(moving) : -1;

	return (
		<FieldShell id={searchId} label={label} hint={hint} error={error}>
			{selected.length > 0 ? (
				<>
					<DndContext
						id={contextId}
						sensors={sensors}
						collisionDetection={closestCenter}
						modifiers={[restrictToParentElement]}
						accessibility={{
							announcements: announcementsFor(selected),
							screenReaderInstructions: INSTRUCTIONS,
						}}
						onDragEnd={onDragEnd}
					>
						<SortableContext items={selected} strategy={rectSortingStrategy}>
							<ul
								aria-label={`${label} elegidas, en orden`}
								className="flex flex-wrap gap-2"
							>
								{selected.map((tech, index) => (
									<Pill
										key={tech}
										tech={tech}
										index={index}
										count={selected.length}
										moving={moving === tech}
										reducedMotion={reducedMotion}
										onToggleMove={() =>
											setMoving((now) => (now === tech ? null : tech))
										}
										onRemove={() => remove(tech)}
									/>
								))}
							</ul>
						</SortableContext>
					</DndContext>

					{selected.length > 1 && movingIndex < 0 ? (
						<p className="text-sm text-muted-foreground">
							El orden es el de los iconos en la tarjeta. Arrastra el asa de una
							tecnología, o toca su nombre para moverla con botones.
						</p>
					) : null}

					{movingIndex >= 0 && moving ? (
						<fieldset className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/40 p-2">
							<legend className="sr-only">{`Mover ${moving}`}</legend>
							<p aria-live="polite" className="mr-1 px-1 text-sm">
								<span className="font-medium">{moving}</span>
								<span className="eyebrow ml-2">
									{movingIndex + 1} de {selected.length}
								</span>
							</p>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="min-h-10 gap-1.5"
								disabled={movingIndex === 0}
								onClick={() => moveTo(moving, 0)}
							>
								<ChevronsLeft aria-hidden="true" /> Al inicio
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="min-h-10 gap-1.5"
								disabled={movingIndex === 0}
								onClick={() => moveTo(moving, movingIndex - 1)}
							>
								<ChevronLeft aria-hidden="true" /> Antes
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="min-h-10 gap-1.5"
								disabled={movingIndex === selected.length - 1}
								onClick={() => moveTo(moving, movingIndex + 1)}
							>
								Después <ChevronRight aria-hidden="true" />
							</Button>
							<Button
								type="button"
								variant="outline"
								size="sm"
								className="min-h-10 gap-1.5"
								disabled={movingIndex === selected.length - 1}
								onClick={() => moveTo(moving, selected.length - 1)}
							>
								Al final <ChevronsRight aria-hidden="true" />
							</Button>
							<Button
								type="button"
								variant="ghost"
								size="sm"
								className="min-h-10 gap-1.5"
								onClick={() => setMoving(null)}
							>
								<Check aria-hidden="true" /> Listo
							</Button>
						</fieldset>
					) : null}
				</>
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
