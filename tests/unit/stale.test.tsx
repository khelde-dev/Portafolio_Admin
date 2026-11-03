// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ContactForm } from "@/components/contact/ContactForm";
import { ApiFailure, api, apiRequest } from "@/lib/apiClient";
import {
	aboutValues,
	educationValues,
	experienceValues,
	skillValues,
} from "@/lib/contentForms";
import { duplicateValues, rowToValues } from "@/lib/projectForm";
import type { ContactRow } from "@/schemas/contact";
import type { ProjectRow } from "@/schemas/projects";

vi.mock("@/components/Toaster", () => ({ toast: { success: vi.fn() } }));
vi.mock("astro:env/client", () => ({
	PUBLIC_MEDIA_URL: "https://media.example.dev",
	PUBLIC_ICONS_URL: "https://icons.example.dev/api/icons",
}));

const row: ContactRow = {
	contact_id: 1,
	github_url: "https://github.com/muke78",
	linkedin_url: "https://www.linkedin.com/in/alguien/",
	linkedin_name: "Erick Gonzalez",
	phone: "+52 55 1190 9105",
	email: "persona@example.com",
	created_at: "2026-01-01 00:00:00",
	updated_at: "2026-01-01 10:00:00",
};

beforeEach(() => vi.restoreAllMocks());

const typeEmail = async (value: string) => {
	const email = screen.getByLabelText(/^Correo/);
	await userEvent.clear(email);
	await userEvent.type(email, value);
};
const save = () =>
	userEvent.click(screen.getByRole("button", { name: "Guardar cambios" }));

describe("edicion simultanea en el formulario", () => {
	it("manda la version leida y usa la que devuelve el backend en el siguiente guardado", async () => {
		const put = vi
			.spyOn(api, "put")
			.mockResolvedValueOnce({ updated_at: "2026-01-01 10:05:00" })
			.mockResolvedValueOnce({ updated_at: "2026-01-01 10:06:00" });
		render(<ContactForm initial={row} />);

		await typeEmail("uno@example.com");
		await save();
		await waitFor(() => expect(put).toHaveBeenCalledTimes(1));
		expect(put.mock.calls[0][1]).toMatchObject({
			updated_at: "2026-01-01 10:00:00",
		});

		// Segundo guardado desde la misma pestana: no choca consigo misma.
		await typeEmail("dos@example.com");
		await save();
		await waitFor(() => expect(put).toHaveBeenCalledTimes(2));
		expect(put.mock.calls[1][1]).toMatchObject({
			updated_at: "2026-01-01 10:05:00",
			email: "dos@example.com",
		});
	});

	it("si otra pestana guardo primero, avisa con un boton para recargar y no pierde lo escrito", async () => {
		vi.spyOn(api, "put").mockRejectedValue(
			new ApiFailure(
				409,
				"Este elemento cambió desde que lo abriste.",
				[],
				[],
				true,
			),
		);
		render(<ContactForm initial={row} />);
		await typeEmail("tarde@example.com");
		await save();

		const alert = await screen.findByRole("alert");
		expect(alert).toHaveTextContent("cambió desde que lo abriste");
		expect(
			screen.getByRole("button", { name: "Recargar" }),
		).toBeInTheDocument();
		expect(screen.getByLabelText(/^Correo/)).toHaveValue("tarde@example.com");
	});

	it("un error normal no ofrece recargar", async () => {
		vi.spyOn(api, "put").mockRejectedValue(
			new ApiFailure(502, "El backend respondió con un error."),
		);
		render(<ContactForm initial={row} />);
		await typeEmail("otro@example.com");
		await save();
		await screen.findByText(/El backend respondió con un error/);
		expect(screen.queryByRole("button", { name: "Recargar" })).toBeNull();
	});
});

describe("ApiFailure.stale", () => {
	it("sale de la respuesta del admin cuando trae stale: true", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(
				Response.json({ message: "Cambió", stale: true }, { status: 409 }),
			);
		const error = await apiRequest("PUT", "/api/x", {}, fetcher).catch(
			(e) => e as ApiFailure,
		);
		expect(error).toBeInstanceOf(ApiFailure);
		expect((error as ApiFailure).stale).toBe(true);
	});

	it("un 409 comun (valor repetido) no es stale", async () => {
		const fetcher = vi
			.fn()
			.mockResolvedValue(
				Response.json({ message: "Repetido" }, { status: 409 }),
			);
		const error = (await apiRequest("PUT", "/api/x", {}, fetcher).catch(
			(e) => e,
		)) as ApiFailure;
		expect(error.stale).toBe(false);
	});
});

describe("valores de edicion", () => {
	it("cada formulario de edicion carga la version de su fila", () => {
		const base = { updated_at: "2026-01-01 10:00:00", created_at: "x" };
		expect(
			experienceValues({
				...base,
				experience_id: 1,
				sort_order: 0,
				work_default: null,
				title_default: "a",
				subtitle_default: "b",
				img: "i",
				alt: "a",
				time_default: "2020 - 2021",
				location_default: "x",
				translations: {},
			}).updated_at,
		).toBe(base.updated_at);
		expect(
			educationValues({
				...base,
				education_id: 1,
				sort_order: 0,
				institution_default: "a",
				subtitle_default: "b",
				description_default: "c",
				image: "i",
				period_default: "p",
				translations: {},
			}).updated_at,
		).toBe(base.updated_at);
		expect(
			skillValues({
				...base,
				skill_id: 1,
				sort_order: 0,
				title_default: "a",
				images_topics: [],
				translations: {},
			}).updated_at,
		).toBe(base.updated_at);
		expect(aboutValues(null)).not.toHaveProperty("updated_at");
	});

	it("una copia de un proyecto no hereda la version del original", () => {
		const project = {
			project_id: 1,
			slug: "a",
			category: "frontend",
			status: "published",
			featured: 0,
			sort_order: 0,
			card_image: "c",
			gallery: [],
			video_url: null,
			images_topics: [],
			link_repo: null,
			link_web: null,
			fork: 0,
			title_default: "t",
			summary_default: "s",
			description_default: "d",
			translations: {},
			created_at: "x",
			updated_at: "2026-01-01 10:00:00",
		} as unknown as ProjectRow;
		expect(rowToValues(project).updated_at).toBe("2026-01-01 10:00:00");
		expect(duplicateValues(project).updated_at).toBeUndefined();
	});
});
