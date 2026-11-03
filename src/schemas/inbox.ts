import { z } from "zod";

/** Comentarios (`comments`): el admin solo cambia el estado, nunca el texto de un visitante. */
export const COMMENT_STATUSES = ["pending", "published", "hidden"] as const;
export type CommentStatus = (typeof COMMENT_STATUSES)[number];
export const COMMENT_STATUS_LABELS: Record<CommentStatus, string> = {
	pending: "Pendiente",
	published: "Publicado",
	hidden: "Oculto",
};

export const commentStatusSchema = z.object({
	status: z.enum(COMMENT_STATUSES, { error: "Estado no válido" }),
});

export interface CommentRow {
	comment_id: number;
	name: string;
	job: string | null;
	description: string;
	direction: "left" | "bottom";
	country: string;
	country_flag: string;
	status: CommentStatus;
	created_at: string;
	updated_at: string;
}

/** Mensajes de contacto (`contact_messages`). */
export const MESSAGE_STATUSES = ["unread", "read", "replied"] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];
export const MESSAGE_STATUS_LABELS: Record<MessageStatus, string> = {
	unread: "Sin leer",
	read: "Leído",
	replied: "Respondido",
};

export const messageStatusSchema = z.object({
	status: z.enum(MESSAGE_STATUSES, { error: "Estado no válido" }),
});

/** Filtro `?status=` de la bandeja. */
export const messageQuerySchema = z.object({
	status: z.enum(MESSAGE_STATUSES).optional(),
});

export interface MessageRow {
	message_id: number;
	name: string;
	email: string;
	phone: string;
	more_information: string | null;
	status: MessageStatus;
	replied_at: string | null;
	created_at: string;
	updated_at: string;
}
