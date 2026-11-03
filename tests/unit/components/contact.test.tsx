// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContactForm } from "@/components/contact/ContactForm";
import { api } from "@/lib/apiClient";
import type { ContactRow } from "@/schemas/contact";

vi.mock("react-hot-toast", () => ({ default: { success: vi.fn() } }));

const row: ContactRow = {
	contact_id: 1,
	github_url: "https://github.com/muke78",
	linkedin_url: "https://www.linkedin.com/in/alguien/",
	linkedin_name: "Erick Gonzalez",
	phone: "+52 55 1190 9105",
	email: "persona@example.com",
	created_at: "2026-01-01 00:00:00",
	updated_at: "2026-01-01 00:00:00",
};

beforeEach(() => vi.restoreAllMocks());

describe("ContactForm", () => {
	it("muestra lo guardado y a donde llevara el boton de WhatsApp", () => {
		render(<ContactForm initial={row} />);
		expect(screen.getByLabelText(/^Teléfono/)).toHaveValue("+52 55 1190 9105");
		expect(
			screen.getByText(/https:\/\/wa\.me\/525511909105/),
		).toBeInTheDocument();
	});

	it("guarda con PUT /api/contact-info y manda solo los cinco datos", async () => {
		const put = vi.spyOn(api, "put").mockResolvedValue(null);
		render(<ContactForm initial={row} />);
		const email = screen.getByLabelText(/^Correo/);
		await userEvent.clear(email);
		await userEvent.type(email, "NUEVO@Example.com");
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		await waitFor(() => expect(put).toHaveBeenCalledOnce());
		expect(put).toHaveBeenCalledWith("/api/contact-info", {
			...Object.fromEntries(
				Object.entries(row).filter(
					([k]) => !k.endsWith("_at") && k !== "contact_id",
				),
			),
			email: "nuevo@example.com",
		});
	});

	it("sin fila arranca vacio y avisa que dato falta", async () => {
		const put = vi.spyOn(api, "put");
		render(<ContactForm initial={null} />);
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		expect(
			await screen.findByText("El enlace de GitHub es obligatorio"),
		).toBeInTheDocument();
		expect(screen.getByText("El teléfono es obligatorio")).toBeInTheDocument();
		expect(put).not.toHaveBeenCalled();
	});

	it("un enlace de otro sitio no se envia", async () => {
		const put = vi.spyOn(api, "put");
		render(<ContactForm initial={row} />);
		const github = screen.getByLabelText(/^Perfil de GitHub/);
		await userEvent.clear(github);
		await userEvent.type(github, "https://evil.example/x");
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		expect(
			await screen.findByText("Escribe una URL https de github.com"),
		).toBeInTheDocument();
		expect(put).not.toHaveBeenCalled();
	});

	it("la vista previa de WhatsApp sigue lo que se escribe", async () => {
		render(<ContactForm initial={null} />);
		expect(screen.getByText(/se arma con este teléfono/)).toBeInTheDocument();
		await userEvent.type(screen.getByLabelText(/^Teléfono/), "+1 555 123 4567");
		expect(
			screen.getByText(/https:\/\/wa\.me\/15551234567/),
		).toBeInTheDocument();
	});
});
