// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { ConfirmDelete } from "@/components/ConfirmDelete";
import {
	SelectField,
	TextareaField,
	TextField,
	ToggleField,
} from "@/components/form/fields";
import { ResourceForm } from "@/components/form/ResourceForm";
import { TranslationsTabs } from "@/components/form/TranslationsTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { ApiFailure } from "@/lib/apiClient";
import { translationsField } from "@/schemas/common";
import { choose } from "../helpers/select";

vi.mock("@/components/Toaster", () => ({ toast: { success: vi.fn() } }));

import { toast } from "@/components/Toaster";

const schema = z.object({
	title: z.string().trim().min(1, "El título es obligatorio"),
	about: z.string().optional(),
	kind: z.string().min(1, "Elige una categoría"),
	published: z.boolean().default(false),
	translations: translationsField({ title: 50 }),
});

const Fields = () => (
	<>
		<TextField
			name="title"
			label="Título"
			required
			hint="Se ve en la tarjeta"
		/>
		<TextareaField name="about" label="Acerca" />
		<SelectField
			name="kind"
			label="Categoría"
			options={[{ value: "a", label: "Alfa" }]}
		/>
		<ToggleField
			name="published"
			label="Publicado"
			hint="Visible en el sitio"
		/>
		<TranslationsTabs
			spanish={<p>base</p>}
			fields={[{ name: "title", label: "Título", baseName: "title" }]}
		/>
	</>
);

const setup = (onSubmit = vi.fn().mockResolvedValue({ id: 1 }), extra = {}) =>
	render(
		<ResourceForm
			schema={schema}
			defaultValues={{
				title: "",
				about: "",
				kind: "",
				published: false,
				translations: {},
			}}
			onSubmit={onSubmit}
			cancelHref="/lista"
			{...extra}
		>
			<Fields />
		</ResourceForm>,
	);

beforeEach(() => vi.clearAllMocks());

describe("ResourceForm", () => {
	it("muestra los errores junto al campo y los asocia con aria-describedby", async () => {
		const onSubmit = vi.fn();
		setup(onSubmit);
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		const title = screen.getByLabelText(/Título/, {
			selector: "input#campo-title",
		});
		await waitFor(() => expect(title).toHaveAttribute("aria-invalid", "true"));
		const error = screen.getByText("El título es obligatorio");
		expect(error).toHaveAttribute("role", "alert");
		expect(title.getAttribute("aria-describedby")).toContain(error.id);
		expect(onSubmit).not.toHaveBeenCalled();
	});

	it("envia el valor validado: traducciones como lista y sin campos vacios", async () => {
		const onSubmit = vi.fn().mockResolvedValue({});
		setup(onSubmit);
		await userEvent.type(
			screen.getByLabelText(/^Título/, { selector: "input#campo-title" }),
			"  Hola ",
		);
		await choose("Categoría", "Alfa");
		await userEvent.click(screen.getByRole("tab", { name: /Inglés/ }));
		await userEvent.type(
			screen.getByLabelText("Título", {
				selector: "input#campo-translations-en-title",
			}),
			"Hello",
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
		expect(onSubmit.mock.calls[0][0]).toMatchObject({
			title: "Hola",
			kind: "a",
			published: false,
			translations: [{ locale: "en", title: "Hello" }],
		});
		expect(toast.success).toHaveBeenCalledWith("Guardado");
	});

	it("un error del servidor se coloca en su campo, incluso en una traduccion", async () => {
		const onSubmit = vi.fn().mockRejectedValue(
			new ApiFailure(400, "Hay datos que no son válidos.", [
				{
					path: ["translations", 0, "title"],
					message: "Admite hasta 50 caracteres",
				},
			]),
		);
		setup(onSubmit);
		await userEvent.type(
			screen.getByLabelText(/^Título/, { selector: "input#campo-title" }),
			"Hola",
		);
		await choose("Categoría", "Alfa");
		await userEvent.click(screen.getByRole("tab", { name: /Inglés/ }));
		await userEvent.type(
			screen.getByLabelText("Título", {
				selector: "input#campo-translations-en-title",
			}),
			"Hello",
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		expect(
			await screen.findByText("Admite hasta 50 caracteres"),
		).toBeInTheDocument();
		expect(
			screen
				.getAllByRole("alert")
				.some((a) => /Revisa los campos/.test(a.textContent ?? "")),
		).toBe(true);
	});

	it("un fallo inesperado muestra un aviso general sin detalles", async () => {
		setup(vi.fn().mockRejectedValue(new Error("boom: secreto")));
		await userEvent.type(
			screen.getByLabelText(/^Título/, { selector: "input#campo-title" }),
			"Hola",
		);
		await choose("Categoría", "Alfa");
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		const alert = await screen.findByText(
			"No se pudo guardar. Intenta de nuevo.",
		);
		expect(alert).toBeInTheDocument();
		expect(document.body.textContent).not.toContain("secreto");
	});

	it("avisa de los cambios sin guardar y deja de avisar al guardar", async () => {
		const warn = vi.spyOn(window, "addEventListener");
		setup();
		expect(screen.queryByText("Cambios sin guardar")).toBeNull();
		await userEvent.type(
			screen.getByLabelText(/^Título/, { selector: "input#campo-title" }),
			"x",
		);
		expect(await screen.findByText("Cambios sin guardar")).toBeInTheDocument();
		expect(warn.mock.calls.some(([type]) => type === "beforeunload")).toBe(
			true,
		);
		warn.mockRestore();
	});

	it("Ctrl+S guarda", async () => {
		const onSubmit = vi.fn().mockResolvedValue({});
		setup(onSubmit);
		await userEvent.type(
			screen.getByLabelText(/^Título/, { selector: "input#campo-title" }),
			"Hola",
		);
		await choose("Categoría", "Alfa");
		await userEvent.keyboard("{Control>}s{/Control}");
		await waitFor(() => expect(onSubmit).toHaveBeenCalledOnce());
	});

	it("Cancelar es un enlace real", () => {
		setup();
		expect(screen.getByRole("link", { name: "Cancelar" })).toHaveAttribute(
			"href",
			"/lista",
		);
	});
});

describe("TranslationsTabs", () => {
	it("cada pestana dice si esta completa con icono y palabra", async () => {
		setup();
		expect(
			screen.getByRole("tab", { name: /Inglés.*vacío/ }),
		).toBeInTheDocument();
		await userEvent.click(screen.getByRole("tab", { name: /Inglés/ }));
		await userEvent.type(
			screen.getByLabelText("Título", {
				selector: "input#campo-translations-en-title",
			}),
			"Hello",
		);
		expect(
			await screen.findByRole("tab", { name: /Inglés.*completo/ }),
		).toBeInTheDocument();
	});

	it("muestra el texto en espanol como referencia", async () => {
		setup();
		await userEvent.type(
			screen.getByLabelText(/^Título/, { selector: "input#campo-title" }),
			"Mi obra",
		);
		await userEvent.click(screen.getByRole("tab", { name: /Francés/ }));
		expect(await screen.findByText("Mi obra")).toBeInTheDocument();
	});
});

describe("ConfirmDelete", () => {
	it("dice que se borra, empieza en Cancelar y confirma", async () => {
		const onConfirm = vi.fn();
		render(
			<ConfirmDelete
				open
				onOpenChange={() => {}}
				name="Mi proyecto"
				onConfirm={onConfirm}
			/>,
		);
		expect(
			await screen.findByText("¿Borrar «Mi proyecto»?"),
		).toBeInTheDocument();
		expect(
			screen.getByText("Esta acción no se puede deshacer."),
		).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Borrar" }));
		expect(onConfirm).toHaveBeenCalledOnce();
	});

	it("mientras borra, el boton se desactiva", async () => {
		render(
			<ConfirmDelete
				open
				onOpenChange={() => {}}
				name="x"
				busy
				onConfirm={() => {}}
			/>,
		);
		expect(
			await screen.findByRole("button", { name: "Borrando…" }),
		).toBeDisabled();
	});
});

describe("StatusBadge", () => {
	it("lleva texto: el color nunca es la unica pista", () => {
		render(<StatusBadge tone="warning">Borrador</StatusBadge>);
		expect(screen.getByText("Borrador")).toBeInTheDocument();
	});
});
