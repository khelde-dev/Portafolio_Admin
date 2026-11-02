import { Check, EyeOff, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import { LocalTime } from "@/components/LocalTime";
import { EmptyState, ErrorState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiFailure, api } from "@/lib/apiClient";
import {
	COMMENT_STATUS_LABELS,
	COMMENT_STATUSES,
	type CommentRow,
	type CommentStatus,
} from "@/schemas/inbox";

interface Props {
	initial: CommentRow[] | null;
	initialError?: string | null;
}

const EMPTY: Record<CommentStatus, { title: string; description: string }> = {
	pending: {
		title: "No hay comentarios por moderar",
		description:
			"Los nuevos llegan aquí y no se ven en el sitio hasta que los publiques.",
	},
	published: {
		title: "Todavía no hay comentarios publicados",
		description: "Publica uno desde la pestaña Pendientes.",
	},
	hidden: {
		title: "No hay comentarios ocultos",
		description: "Lo que ocultes sigue guardado y puedes volver a publicarlo.",
	},
};

/**
 * Moderacion de comentarios. Un comentario nuevo nace PENDIENTE y no se ve en el
 * sitio hasta publicarlo. Aqui solo se cambia el estado: el texto de un
 * visitante nunca se edita. El borrado definitivo solo se ofrece en "Ocultos".
 */
export const CommentsApp = ({ initial, initialError = null }: Props) => {
	const [rows, setRows] = useState<CommentRow[]>(initial ?? []);
	const [loadError, setLoadError] = useState<string | null>(initialError);
	const [notice, setNotice] = useState<string | null>(null);
	const [deleting, setDeleting] = useState<CommentRow | null>(null);
	const [busy, setBusy] = useState(false);

	const byStatus = useMemo(() => {
		const groups: Record<CommentStatus, CommentRow[]> = {
			pending: [],
			published: [],
			hidden: [],
		};
		for (const row of [...rows].sort((a, b) =>
			b.created_at.localeCompare(a.created_at),
		)) {
			groups[row.status].push(row);
		}
		return groups;
	}, [rows]);

	const reload = async () => {
		setLoadError(null);
		try {
			setRows((await api.get<CommentRow[]>("/api/comments")) ?? []);
		} catch (error) {
			setLoadError(
				error instanceof ApiFailure ? error.message : "No se pudo cargar.",
			);
		}
	};

	const setStatus = async (row: CommentRow, status: CommentStatus) => {
		const before = rows;
		setRows((list) =>
			list.map((r) => (r.comment_id === row.comment_id ? { ...r, status } : r)),
		);
		setNotice(null);
		try {
			await api.put(`/api/comments/${row.comment_id}`, { status });
		} catch (error) {
			setRows(before);
			setNotice(
				error instanceof ApiFailure
					? error.message
					: "No se pudo cambiar el estado.",
			);
		}
	};

	const remove = async () => {
		if (!deleting) return;
		setBusy(true);
		try {
			await api.delete(`/api/comments/${deleting.comment_id}`);
			setRows((list) =>
				list.filter((r) => r.comment_id !== deleting.comment_id),
			);
			setDeleting(null);
		} catch (error) {
			setDeleting(null);
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
				title="No se pudieron cargar los comentarios"
				description={loadError}
				onRetry={reload}
			/>
		);
	}

	return (
		<>
			{notice ? (
				<p
					role="alert"
					className="mb-5 rounded-lg border border-destructive/40 bg-destructive/5 px-4 py-3 font-medium text-destructive"
				>
					{notice}
				</p>
			) : null}

			<Tabs defaultValue="pending" className="gap-5">
				<TabsList
					variant="line"
					aria-label="Estado del comentario"
					className="h-auto flex-wrap"
				>
					{COMMENT_STATUSES.map((status) => (
						<TabsTrigger key={status} value={status} className="min-h-11 px-4">
							{COMMENT_STATUS_LABELS[status]}
							<span className="eyebrow ml-2">{byStatus[status].length}</span>
						</TabsTrigger>
					))}
				</TabsList>

				{COMMENT_STATUSES.map((status) => (
					<TabsContent key={status} value={status}>
						{byStatus[status].length === 0 ? (
							<EmptyState {...EMPTY[status]} />
						) : (
							<ul
								aria-label={COMMENT_STATUS_LABELS[status]}
								className="border-t border-border"
							>
								{byStatus[status].map((row) => (
									<li
										key={row.comment_id}
										className="grid gap-4 border-b border-border px-1 py-5 md:grid-cols-[minmax(0,1fr)_auto]"
									>
										<div className="min-w-0">
											<p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
												<span className="font-serif-display text-heading">
													{row.name}
												</span>
												{row.job ? (
													<span className="text-muted-foreground">
														{row.job}
													</span>
												) : null}
											</p>
											<p className="eyebrow mt-1">
												{row.country}, <LocalTime value={row.created_at} />
											</p>
											{/* Texto de un visitante: siempre como texto. */}
											<p className="mt-3 max-w-[68ch] whitespace-pre-wrap break-words text-[1.0625rem] leading-relaxed">
												{row.description}
											</p>
										</div>
										<div className="flex flex-wrap items-start gap-2 md:flex-col md:items-stretch">
											{status !== "published" ? (
												<Button
													type="button"
													className="min-h-11"
													onClick={() => setStatus(row, "published")}
												>
													<Check aria-hidden="true" /> Publicar
												</Button>
											) : null}
											{status !== "hidden" ? (
												<Button
													type="button"
													variant="outline"
													className="min-h-11"
													onClick={() => setStatus(row, "hidden")}
												>
													<EyeOff aria-hidden="true" /> Ocultar
												</Button>
											) : null}
											{status === "published" ? (
												<Button
													type="button"
													variant="ghost"
													className="min-h-11"
													onClick={() => setStatus(row, "pending")}
												>
													<RotateCcw aria-hidden="true" /> Volver a pendiente
												</Button>
											) : null}
											{status === "hidden" ? (
												<Button
													type="button"
													variant="destructive"
													className="min-h-11"
													onClick={() => setDeleting(row)}
												>
													<Trash2 aria-hidden="true" /> Borrar
												</Button>
											) : null}
										</div>
									</li>
								))}
							</ul>
						)}
					</TabsContent>
				))}
			</Tabs>

			<ConfirmDelete
				open={deleting !== null}
				onOpenChange={(open) => !open && setDeleting(null)}
				name={deleting?.name ?? ""}
				consequence="Se borra el comentario de forma definitiva. Si solo quieres que no se vea, déjalo oculto."
				busy={busy}
				onConfirm={remove}
			/>
		</>
	);
};
