import { ArrowLeft, Mail, MessageCircle, Phone, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { type Column, DataTable } from "@/components/DataTable";
import { FilterToggle } from "@/components/form/FilterToggle";
import { LocalTime } from "@/components/LocalTime";
import { StatusBadge, type Tone } from "@/components/StatusBadge";
import { EmptyState, ErrorState } from "@/components/states";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button, buttonVariants } from "@/components/ui/button";
import { useDeleteTarget } from "@/hooks/useDeleteTarget";
import { useUrlParam } from "@/hooks/useUrlParams";
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
	// El filtro, el mensaje abierto y el modal de borrar viven en la URL.
	const [filterRaw, setFilter] = useUrlParam("estado", "all", {
		resetsPage: true,
	});
	const filter: Filter = FILTERS.some((f) => f.value === filterRaw)
		? (filterRaw as Filter)
		: "all";
	const [openedRaw, setOpened] = useUrlParam("mensaje");
	const selectedId = /^\d+$/.test(openedRaw) ? Number(openedRaw) : null;
	const [notice, setNotice] = useState<string | null>(null);
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
	const { deleting, requestDelete, cancelDelete } = useDeleteTarget(
		rows,
		(row) => row.message_id,
	);

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
		setOpened(String(row.message_id), { push: true });
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
			setOpened("");
			cancelDelete();
		} catch (error) {
			cancelDelete();
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

	const columns: Column<MessageRow>[] = [
		{
			id: "message",
			header: "Mensaje",
			hideHeader: true,
			className: "min-w-0 p-0 max-md:w-full",
			cell: (row) => {
				const active = row.message_id === selectedId;
				return (
					<Button
						type="button"
						variant="ghost"
						onClick={() => open(row)}
						aria-current={active ? "true" : undefined}
						className={cn(
							"h-auto min-h-20 w-full flex-col items-stretch gap-1.5 rounded-lg px-4 py-3 text-left whitespace-normal",
							active && "bg-muted",
						)}
					>
						<span className="flex items-center justify-between gap-3">
							<span
								className={cn(
									"min-w-0 truncate",
									row.status === "unread" ? "font-semibold" : "font-medium",
								)}
							>
								{row.status === "unread" ? (
									<span className="sr-only">Sin leer:</span>
								) : null}{" "}
								{row.name}
							</span>
							<StatusBadge tone={TONE[row.status]} className="shrink-0">
								{MESSAGE_STATUS_LABELS[row.status]}
							</StatusBadge>
						</span>
						<span className="line-clamp-1 text-sm text-muted-foreground">
							{snippet(row.more_information) || row.email}
						</span>
						<LocalTime value={row.created_at} className="eyebrow" />
					</Button>
				);
			},
		},
	];

	return (
		<div className="grid lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]">
			<section
				aria-label="Lista de mensajes"
				className={cn(
					"min-w-0 lg:border-r lg:border-border lg:pr-8",
					selected ? "hidden lg:block" : "block",
				)}
			>
				<DataTable
					rows={visible}
					getId={(row) => row.message_id}
					label="Mensajes"
					toolbar="stacked"
					searchLabel="Buscar mensaje"
					searchText={(row) =>
						`${row.name} ${row.email} ${row.more_information ?? ""}`
					}
					filters={
						<FilterToggle
							label="Filtrar por estado"
							fill
							value={filter}
							onValueChange={(value) => setFilter(value, { push: true })}
							options={FILTERS.map(({ value, label }) => ({
								value,
								label: (
									<>
										{label}
										<span className="eyebrow ml-1.5">{counts[value]}</span>
									</>
								),
							}))}
						/>
					}
					empty={null}
					columns={columns}
				/>
			</section>

			<section
				aria-label="Mensaje"
				className={cn(
					"min-w-0 lg:sticky lg:top-24 lg:self-start lg:pl-8",
					selected ? "block" : "hidden lg:block",
				)}
			>
				{notice ? (
					<Alert variant="destructive" className="mb-4">
						<AlertDescription>{notice}</AlertDescription>
					</Alert>
				) : null}

				{selected ? (
					<article className="flex flex-col gap-6">
						<Button
							type="button"
							variant="ghost"
							className="min-h-11 w-fit px-2 lg:hidden"
							onClick={() => setOpened("")}
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
									variant="outline"
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
								onClick={() => requestDelete(selected)}
							>
								<Trash2 aria-hidden="true" /> Borrar
							</Button>
						</div>

						<ConfirmDelete
							open={deleting !== null}
							onOpenChange={(next) => !next && cancelDelete()}
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
