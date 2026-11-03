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
import {
	restrictToParentElement,
	restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { MoveButtons } from "@/components/OrderControls";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props<T> {
	rows: readonly T[];
	getId: (row: T) => number;
	getTitle: (row: T) => string;
	/** Datos secundarios en mono, bajo el titulo. */
	describe: (row: T) => ReactNode;
	/** Miniatura opcional a la izquierda del titulo. */
	thumb?: (row: T) => ReactNode;
	/** Mueve el elemento de la posicion `from` a la `to` (indices de `rows`). */
	onMoveTo: (from: number, to: number) => void;
	/** Nombre de la lista para lectores de pantalla. */
	label: string;
}

const INSTRUCTIONS: ScreenReaderInstructions = {
	draggable:
		"Para mover este elemento, pulsa la barra espaciadora para tomarlo, las flechas arriba y abajo para cambiarlo de lugar y la barra espaciadora otra vez para soltarlo. Escape cancela.",
};

/** Tras soltar, el aviso del lector dice la posicion final, no un indice interno. */
const useAnnouncements = <T,>(
	rows: readonly T[],
	getId: (row: T) => number,
	getTitle: (row: T) => string,
): Announcements => {
	const place = (id: string | number) => {
		const index = rows.findIndex((row) => getId(row) === id);
		return {
			name: index >= 0 ? getTitle(rows[index]) : "Elemento",
			position: index + 1,
			total: rows.length,
		};
	};
	return {
		onDragStart: ({ active }) => {
			const { name, position, total } = place(active.id);
			return `Tomaste ${name}, posición ${position} de ${total}.`;
		},
		onDragOver: ({ active, over }) => {
			if (!over) return undefined;
			const moving = place(active.id);
			const target = place(over.id);
			return `${moving.name} está sobre la posición ${target.position} de ${target.total}.`;
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

export function SortableList<T>({
	rows,
	getId,
	getTitle,
	describe,
	thumb,
	onMoveTo,
	label,
}: Props<T>) {
	const reducedMotion = useReducedMotion();
	const announcements = useAnnouncements(rows, getId, getTitle);
	const contextId = useId();
	const ids = rows.map(getId);
	const sensors = useSensors(
		// 6 px de recorrido antes de empezar: un toque o clic en el asa no arrastra.
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const onDragEnd = ({ active, over }: DragEndEvent) => {
		if (!over || active.id === over.id) return;
		const from = ids.indexOf(active.id as number);
		const to = ids.indexOf(over.id as number);
		if (from >= 0 && to >= 0) onMoveTo(from, to);
	};

	return (
		<DndContext
			id={contextId}
			sensors={sensors}
			collisionDetection={closestCenter}
			modifiers={[restrictToVerticalAxis, restrictToParentElement]}
			accessibility={{ announcements, screenReaderInstructions: INSTRUCTIONS }}
			onDragEnd={onDragEnd}
		>
			<SortableContext items={ids} strategy={verticalListSortingStrategy}>
				<ol aria-label={label} className="flex flex-col gap-2">
					{rows.map((row, index) => (
						<Item
							key={getId(row)}
							id={getId(row)}
							index={index}
							count={rows.length}
							title={getTitle(row)}
							describe={describe(row)}
							thumb={thumb?.(row)}
							reducedMotion={reducedMotion}
							onMove={(delta) => onMoveTo(index, index + delta)}
						/>
					))}
				</ol>
			</SortableContext>
		</DndContext>
	);
}

function Item({
	id,
	index,
	count,
	title,
	describe,
	thumb,
	reducedMotion,
	onMove,
}: {
	id: number;
	index: number;
	count: number;
	title: string;
	describe: ReactNode;
	thumb: ReactNode;
	reducedMotion: boolean;
	onMove: (delta: number) => void;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id });

	return (
		<li
			ref={setNodeRef}
			style={{
				transform: CSS.Translate.toString(transform),
				transition: reducedMotion ? undefined : transition,
			}}
			className={cn(
				"relative flex items-center gap-2 rounded-lg border bg-card p-2 sm:gap-3 sm:pr-3",
				isDragging
					? "z-10 border-primary shadow-[var(--glow-soft)]"
					: "border-border",
			)}
		>
			<button
				type="button"
				ref={setActivatorNodeRef}
				{...attributes}
				{...listeners}
				aria-label={`Mover ${title}`}
				className={cn(
					buttonVariants({ variant: "ghost", size: "icon" }),
					"size-11 shrink-0 cursor-grab touch-none text-muted-foreground active:cursor-grabbing",
					isDragging && "cursor-grabbing text-primary",
				)}
			>
				<GripVertical aria-hidden="true" />
			</button>
			<span
				aria-hidden="true"
				className="eyebrow w-6 shrink-0 text-right tabular-nums"
			>
				{index + 1}
			</span>
			{thumb}
			<div className="min-w-0 flex-1">
				<p className="font-serif-display text-heading break-words">{title}</p>
				<div className="eyebrow mt-1 break-words">{describe}</div>
			</div>
			<MoveButtons name={title} index={index} count={count} onMove={onMove} />
		</li>
	);
}
