import { ArrowLeft, Mail, MessageCircle, Phone, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { LocalTime } from "@/components/LocalTime";
import { StatusBadge, type Tone } from "@/components/StatusBadge";
import { EmptyState, ErrorState } from "@/components/states";
import { Button, buttonVariants } from "@/components/ui/button";
import { ApiFailure, api } from "@/lib/apiClient";
import { mailtoHref, snippet, telHref, whatsappHref } from "@/lib/contact";
import { cn } from "@/lib/utils";
import {
	MESSAGE_STATUS_LABELS,
	type MessageRow,
	type MessageStatus,
} from "@/schemas/inbox";

type Filter = "all" | MessageStatus;

const FILTERS: { value: Filter; label: string }[] = [
	{ value: "all", label: "Todos" },
	{ value: "unread", label: "Sin leer" },
	{ value: "read", label: "Leídos" },
	{ value: "replied", label: "Respondidos" },
];

const TONE: Record<MessageStatus, Tone> = {
	unread: "primary",
	read: "neutral",
	replied: "success",
};

interface Props {
	initial: MessageRow[] | null;
	/** Mensaje de error si el servidor no pudo leer la bandeja. */
	initialError?: string | null;
}

/**
 * Bandeja de mensajes de contacto. Dos paneles en escritorio (lista + detalle) y
 * una pantalla a la vez en el movil. Abrir un mensaje sin leer lo marca leido;
 * "respondido" es una marca manual (el correo se abre con `mailto:`).
 */
export const InboxApp = ({ initial, initialError = null }: Props) => {
	const [rows, setRows] = useState<MessageRow[]>(initial ?? []);
	const [loadError, setLoadError] = useState<string | null>(initialError);
	const [filter, setFilter] = useState<Filter>("all");
	const [selectedId, setSelectedId] = useState<number | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [busy, setBusy] = useState(false);

	const counts = useMemo(() => {
		const c: Record<Filter, number> = {
			all: rows.length,
			unread: 0,
			read: 0,
			replied: 0,
		};
		for (const r of rows) c[r.status] += 1;
		return c;
	}, [rows]);

	const visible = useMemo(
		() => (filter === "all" ? rows : rows.filter((r) => r.status === filter)),
		[rows, filter],
	);
	const selected = rows.find((r) => r.message_id === selectedId) ?? null;

	const reload = async () => {
		setLoadError(null);
		try {
			setRows((await api.get<MessageRow[]>("/api/contact-messages")) ?? []);
		} catch (error) {
			setLoadError(
				error instanceof ApiFailure ? error.message : "No se pudo cargar.",
			);
		}
	};

	const setStatus = async (row: MessageRow, status: MessageStatus) => {
		if (row.status === status) return;
		const before = rows;
		// Optimista: la lista responde al instante y vuelve atras si falla.
		setRows((list) =>
			list.map((r) => (r.message_id === row.message_id ? { ...r, status } : r)),
		);
		setNotice(null);
		try {
			await api.put(`/api/contact-messages/${row.message_id}`, { status });
		} catch (error) {
			setRows(before);
			setNotice(
				error instanceof ApiFailure
					? error.message
					: "No se pudo cambiar el estado.",
			);
		}
	};

	const open = (row: MessageRow) => {
		setSelectedId(row.message_id);
		setNotice(null);
		if (row.status === "unread") void setStatus(row, "read");
	};

	const remove = async () => {
		if (!selected) return;
		setBusy(true);
		try {
			await api.delete(`/api/contact-messages/${selected.message_id}`);
			setRows((list) =>
				list.filter((r) => r.message_id !== selected.message_id),
			);
			setSelectedId(null);
			setConfirming(false);
		} catch (error) {
			setConfirming(false);
			setNotice(
				error instanceof ApiFailure ? error.message : "No se pudo borrar.",
			);
		} finally {
			setBusy(false);
		}
	};

	if (loadError && rows.length === 0) {
		return (
			<ErrorState
				title="No se pudo cargar la bandeja"
				description={loadError}
				onRetry={reload}
			/>
		);
	}
	if (rows.length === 0) {
		return (
			<EmptyState
				title="Todavía no hay mensajes"
				description="Cuando alguien escriba desde el formulario del portafolio, aparecerá aquí."
			/>
		);
	}

	return (
		<div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
			<section
				aria-label="Lista de mensajes"
				className={cn("min-w-0", selected ? "hidden lg:block" : "block")}
			>
				<fieldset className="mb-3 flex min-w-0 flex-wrap gap-1">
					<legend className="sr-only">Filtrar por estado</legend>
					{FILTERS.map(({ value, label }) => (
						<button
							key={value}
							type="button"
							aria-pressed={filter === value}
							onClick={() => setFilter(value)}
							className={cn(
								"min-h-11 rounded-md px-3 text-[0.9375rem] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
								filter === value
									? "bg-muted text-foreground"
									: "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
							)}
						>
							{label}
							<span className="eyebrow ml-1.5">{counts[value]}</span>
						</button>
					))}
				</fieldset>

				{visible.length === 0 ? (
					<EmptyState
						title="Nada en esta vista"
						description="Cambia el filtro para ver los demás mensajes."
					/>
				) : (
					<ul aria-label="Mensajes" className="border-t border-border">
						{visible.map((row) => {
							const active = row.message_id === selectedId;
							return (
								<li key={row.message_id} className="border-b border-border">
									<button
										type="button"
										onClick={() => open(row)}
										aria-current={active ? "true" : undefined}
										className={cn(
											"flex w-full min-h-16 flex-col gap-1 px-3 py-3 text-left transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-primary",
											active && "bg-muted",
										)}
									>
										<span className="flex items-baseline justify-between gap-3">
											<span
												className={cn(
													"truncate",
													row.status === "unread"
														? "font-semibold"
														: "font-medium",
												)}
											>
												{row.status === "unread" ? (
													<span className="sr-only">Sin leer:</span>
												) : null}{" "}
												{row.name}
											</span>
											<LocalTime
												value={row.created_at}
												className="eyebrow shrink-0"
											/>
										</span>
										<span className="line-clamp-1 text-sm text-muted-foreground">
											{snippet(row.more_information) || row.email}
										</span>
										<StatusBadge tone={TONE[row.status]} className="w-fit">
											{MESSAGE_STATUS_LABELS[row.status]}
										</StatusBadge>
									</button>
								</li>
							);
						})}
					</ul>
				)}
			</section>

			<section
				aria-label="Mensaje"
				className={cn("min-w-0", selected ? "block" : "hidden lg:block")}
			>
				{notice ? (
					<p
						role="alert"
						className="mb-4 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 font-medium text-destructive"
					>
						{notice}
					</p>
				) : null}

				{selected ? (
					<article className="flex flex-col gap-6">
						<Button
							type="button"
							variant="ghost"
							className="min-h-11 w-fit px-2 lg:hidden"
							onClick={() => setSelectedId(null)}
						>
							<ArrowLeft aria-hidden="true" /> Volver a la lista
						</Button>

						<header className="border-b border-border pb-5">
							<h2 className="font-serif-display text-subtitle">
								{selected.name}
							</h2>
							<p className="eyebrow mt-2">
								<LocalTime value={selected.created_at} />
							</p>
						</header>

						<dl className="grid gap-3 sm:grid-cols-[7rem_1fr]">
							<dt className="text-muted-foreground">Correo</dt>
							<dd className="min-w-0 break-words">
								<a
									className="text-primary underline-offset-4 hover:underline"
									href={mailtoHref(selected.email)}
								>
									{selected.email}
								</a>
							</dd>
							<dt className="text-muted-foreground">Teléfono</dt>
							<dd className="min-w-0 break-words">
								{telHref(selected.phone) ? (
									<a
										className="text-primary underline-offset-4 hover:underline"
										href={telHref(selected.phone) ?? undefined}
									>
										{selected.phone}
									</a>
								) : (
									selected.phone
								)}
							</dd>
							<dt className="text-muted-foreground">Estado</dt>
							<dd>
								<StatusBadge tone={TONE[selected.status]}>
									{MESSAGE_STATUS_LABELS[selected.status]}
								</StatusBadge>
							</dd>
						</dl>

						<div>
							<h3 className="eyebrow mb-2">Mensaje</h3>
							{selected.more_information ? (
								// Texto de un visitante: se muestra como TEXTO, nunca como HTML.
								<p className="whitespace-pre-wrap break-words text-[1.0625rem] leading-relaxed">
									{selected.more_information}
								</p>
							) : (
								<p className="text-muted-foreground">
									No dejó ningún mensaje, solo sus datos.
								</p>
							)}
						</div>

						<div className="flex flex-wrap items-center gap-2 border-t border-border pt-5">
							<a
								className={cn(buttonVariants(), "min-h-11 px-4")}
								href={mailtoHref(
									selected.email,
									"Re: tu mensaje en mi portafolio",
								)}
							>
								<Mail aria-hidden="true" /> Responder por correo
							</a>
							{whatsappHref(selected.phone) ? (
								<a
									className={cn(
										buttonVariants({ variant: "outline" }),
										"min-h-11 px-4",
									)}
									href={whatsappHref(selected.phone) ?? undefined}
									target="_blank"
									rel="noopener noreferrer"
								>
									<MessageCircle aria-hidden="true" /> WhatsApp
								</a>
							) : null}
							{telHref(selected.phone) ? (
								<a
									className={cn(
										buttonVariants({ variant: "outline" }),
										"min-h-11 px-4",
									)}
									href={telHref(selected.phone) ?? undefined}
								>
									<Phone aria-hidden="true" /> Llamar
								</a>
							) : null}
						</div>

						<div className="flex flex-wrap items-center gap-2">
							{selected.status !== "replied" ? (
								<Button
									type="button"
									variant="outline"
									className="min-h-11"
									onClick={() => setStatus(selected, "replied")}
								>
									Marcar como respondido
								</Button>
							) : null}
							{selected.status !== "unread" ? (
								<Button
									type="button"
									variant="ghost"
									className="min-h-11"
									onClick={() => setStatus(selected, "unread")}
								>
									Marcar como sin leer
								</Button>
							) : null}
							<Button
								type="button"
								variant="destructive"
								className="ml-auto min-h-11"
								onClick={() => setConfirming(true)}
							>
								<Trash2 aria-hidden="true" /> Borrar
							</Button>
						</div>

						<ConfirmDelete
							open={confirming}
							onOpenChange={setConfirming}
							name={selected.name}
							consequence="Se borra el mensaje y los datos de contacto. No se puede deshacer."
							busy={busy}
							onConfirm={remove}
						/>
					</article>
				) : (
					<div className="hidden rounded-lg border border-dashed border-border px-6 py-16 text-center text-muted-foreground lg:block">
						Elige un mensaje de la lista para leerlo.
					</div>
				)}
			</section>
		</div>
	);
};
