// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CommentsApp } from "@/components/CommentsApp";
import { InboxApp } from "@/components/InboxApp";
import { ApiFailure, api } from "@/lib/apiClient";
import type { CommentRow, MessageRow } from "@/schemas/inbox";

afterEach(() => vi.restoreAllMocks());

const message = (over: Partial<MessageRow> = {}): MessageRow => ({
	message_id: 1,
	name: "Ana Pérez",
	email: "ana@example.com",
	phone: "+52 55 1234 5678",
	more_information: "Hola, me gustaría hablar de un proyecto.",
	status: "unread",
	replied_at: null,
	created_at: "2026-11-02 14:05:00",
	updated_at: "2026-11-02 14:05:00",
	...over,
});

const comment = (over: Partial<CommentRow> = {}): CommentRow => ({
	comment_id: 1,
	name: "Luis",
	job: "Dev",
	description: "Excelente trabajo, muy recomendable.",
	direction: "left",
	country: "México",
	country_flag: "mx",
	status: "pending",
	created_at: "2026-11-02",
	updated_at: "2026-11-02",
	...over,
});

describe("InboxApp", () => {
	it("sin mensajes invita a esperar el primero", () => {
		render(<InboxApp initial={[]} />);
		expect(screen.getByText("Todavía no hay mensajes")).toBeInTheDocument();
	});

	it("un fallo de lectura muestra el error con Reintentar", async () => {
		vi.spyOn(api, "get").mockResolvedValue([message()]);
		render(
			<InboxApp
				initial={null}
				initialError="El backend rechazó la petición."
			/>,
		);
		expect(screen.getByRole("alert")).toHaveTextContent("El backend rechazó");
		await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
		expect(await screen.findByText("Ana Pérez")).toBeInTheDocument();
	});

	it("cuenta por estado y filtra", async () => {
		render(
			<InboxApp
				initial={[
					message(),
					message({ message_id: 2, name: "Beto", status: "read" }),
					message({ message_id: 3, name: "Cris", status: "replied" }),
				]}
			/>,
		);
		const filters = screen.getByRole("group", { name: "Filtrar por estado" });
		expect(
			within(filters).getByRole("button", { name: /Todos.*3/ }),
		).toBeInTheDocument();
		await userEvent.click(
			within(filters).getByRole("button", { name: /Leídos/ }),
		);
		const list = screen.getByRole("list", { name: "Mensajes" });
		expect(within(list).getByText("Beto")).toBeInTheDocument();
		expect(within(list).queryByText("Ana Pérez")).toBeNull();
	});

	it("abrir un mensaje sin leer lo marca leido (optimista) y lo guarda", async () => {
		const put = vi.spyOn(api, "put").mockResolvedValue(null);
		render(<InboxApp initial={[message()]} />);
		await userEvent.click(
			screen.getByRole("button", { name: /Sin leer: Ana Pérez/ }),
		);
		expect(
			await screen.findByRole("heading", { name: "Ana Pérez", level: 2 }),
		).toBeInTheDocument();
		expect(put).toHaveBeenCalledWith("/api/contact-messages/1", {
			status: "read",
		});
	});

	it("si el guardado falla, vuelve atras y lo dice", async () => {
		vi.spyOn(api, "put").mockRejectedValue(
			new ApiFailure(502, "El backend rechazó la petición."),
		);
		render(<InboxApp initial={[message()]} />);
		await userEvent.click(screen.getByRole("button", { name: /Ana Pérez/ }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"El backend rechazó",
		);
		await waitFor(() =>
			expect(screen.getAllByText("Sin leer").length).toBeGreaterThan(0),
		);
	});

	it("el detalle muestra el texto como texto y arma enlaces seguros", async () => {
		vi.spyOn(api, "put").mockResolvedValue(null);
		render(
			<InboxApp
				initial={[
					message({
						status: "read",
						email: "x?bcc=ladron@evil.com",
						more_information: "<img src=x onerror=alert(1)> hola",
					}),
				]}
			/>,
		);
		await userEvent.click(screen.getByRole("button", { name: /Ana Pérez/ }));
		expect(
			within(await screen.findByRole("article")).getByText(
				/<img src=x onerror=alert\(1\)> hola/,
			),
		).toBeInTheDocument();
		expect(document.querySelector("img[src='x']")).toBeNull();
		const reply = screen.getByRole("link", { name: /Responder por correo/ });
		expect(reply.getAttribute("href")).toContain("mailto:x%3Fbcc");
		expect(reply.getAttribute("href")).not.toContain("?bcc");
		expect(screen.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
			"href",
			"https://wa.me/525512345678",
		);
		expect(screen.getByRole("link", { name: /WhatsApp/ })).toHaveAttribute(
			"rel",
			"noopener noreferrer",
		);
	});

	it("marcar como respondido guarda el estado", async () => {
		const put = vi.spyOn(api, "put").mockResolvedValue(null);
		render(<InboxApp initial={[message({ status: "read" })]} />);
		await userEvent.click(screen.getByRole("button", { name: /Ana Pérez/ }));
		await userEvent.click(
			await screen.findByRole("button", { name: "Marcar como respondido" }),
		);
		expect(put).toHaveBeenCalledWith("/api/contact-messages/1", {
			status: "replied",
		});
	});

	it("borrar pide confirmacion con el nombre y luego quita el mensaje", async () => {
		const del = vi.spyOn(api, "delete").mockResolvedValue(null);
		vi.spyOn(api, "put").mockResolvedValue(null);
		render(<InboxApp initial={[message({ status: "read" })]} />);
		await userEvent.click(screen.getByRole("button", { name: /Ana Pérez/ }));
		await userEvent.click(
			await screen.findByRole("button", { name: "Borrar" }),
		);
		expect(await screen.findByText("¿Borrar «Ana Pérez»?")).toBeInTheDocument();
		await userEvent.click(
			within(screen.getByRole("alertdialog")).getByRole("button", {
				name: "Borrar",
			}),
		);
		await waitFor(() =>
			expect(del).toHaveBeenCalledWith("/api/contact-messages/1"),
		);
		await waitFor(() => expect(screen.queryByText("Ana Pérez")).toBeNull());
	});

	it("si el borrado falla, el mensaje sigue y se avisa", async () => {
		vi.spyOn(api, "delete").mockRejectedValue(
			new ApiFailure(502, "El backend rechazó la petición."),
		);
		vi.spyOn(api, "put").mockResolvedValue(null);
		render(<InboxApp initial={[message({ status: "read" })]} />);
		await userEvent.click(screen.getByRole("button", { name: /Ana Pérez/ }));
		await userEvent.click(
			await screen.findByRole("button", { name: "Borrar" }),
		);
		await userEvent.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Borrar",
			}),
		);
		expect(
			await screen.findByText("El backend rechazó la petición."),
		).toBeInTheDocument();
		expect(
			screen.getByRole("heading", { name: "Ana Pérez", level: 2 }),
		).toBeInTheDocument();
	});
});

describe("CommentsApp", () => {
	it("agrupa por estado con el conteo en cada pestana", () => {
		render(
			<CommentsApp
				initial={[
					comment(),
					comment({ comment_id: 2, name: "Marta", status: "published" }),
					comment({ comment_id: 3, name: "Sara", status: "hidden" }),
				]}
			/>,
		);
		expect(
			screen.getByRole("tab", { name: /Pendiente.*1/ }),
		).toBeInTheDocument();
		expect(
			screen.getByRole("tab", { name: /Publicado.*1/ }),
		).toBeInTheDocument();
		expect(screen.getByRole("tab", { name: /Oculto.*1/ })).toBeInTheDocument();
		expect(screen.getByText("Luis")).toBeInTheDocument();
	});

	it("publicar cambia el estado y guarda; el texto nunca se edita", async () => {
		const put = vi.spyOn(api, "put").mockResolvedValue(null);
		render(<CommentsApp initial={[comment()]} />);
		await userEvent.click(screen.getByRole("button", { name: "Publicar" }));
		expect(put).toHaveBeenCalledWith("/api/comments/1", {
			status: "published",
		});
		expect(screen.queryByRole("textbox")).toBeNull();
	});

	it("un fallo al cambiar el estado vuelve atras y avisa", async () => {
		vi.spyOn(api, "put").mockRejectedValue(
			new ApiFailure(502, "El backend rechazó la petición."),
		);
		render(<CommentsApp initial={[comment()]} />);
		await userEvent.click(screen.getByRole("button", { name: "Ocultar" }));
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"El backend rechazó",
		);
		expect(screen.getByText("Luis")).toBeInTheDocument();
	});

	it("el texto de un visitante se muestra como texto", () => {
		render(
			<CommentsApp
				initial={[comment({ description: "<script>alert(1)</script> hola" })]}
			/>,
		);
		expect(
			screen.getByText("<script>alert(1)</script> hola"),
		).toBeInTheDocument();
		expect(document.querySelector("script")).toBeNull();
	});

	it("borrar solo se ofrece en Ocultos y pide confirmacion", async () => {
		const del = vi.spyOn(api, "delete").mockResolvedValue(null);
		render(<CommentsApp initial={[comment({ status: "hidden" })]} />);
		expect(screen.queryByRole("button", { name: "Borrar" })).toBeNull();
		await userEvent.click(screen.getByRole("tab", { name: /Oculto/ }));
		await userEvent.click(
			await screen.findByRole("button", { name: "Borrar" }),
		);
		await userEvent.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Borrar",
			}),
		);
		await waitFor(() => expect(del).toHaveBeenCalledWith("/api/comments/1"));
	});

	it("estado vacio por pestana y error de carga con reintento", async () => {
		const { unmount } = render(<CommentsApp initial={[]} />);
		expect(
			screen.getByText("No hay comentarios por moderar"),
		).toBeInTheDocument();
		unmount();
		vi.spyOn(api, "get").mockResolvedValue([comment()]);
		render(
			<CommentsApp initial={null} initialError="No se pudo leer el backend." />,
		);
		await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
		expect(await screen.findByText("Luis")).toBeInTheDocument();
	});
});
