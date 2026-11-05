// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CvManager, cvFileProblem } from "@/components/site/CvManager";
import { ApiFailure, api, apiUploadCv, type CvInfo } from "@/lib/apiClient";

vi.mock("@/lib/apiClient", async (importOriginal) => {
	const original = await importOriginal<typeof import("@/lib/apiClient")>();
	return {
		...original,
		apiUploadCv: vi.fn(),
		api: { ...original.api, delete: vi.fn() },
	};
});

afterEach(() => vi.clearAllMocks());

const CV: CvInfo = {
	key: "cv/CV-Erick-Gonzalez-ab12cd34.pdf",
	url: "https://media.example.dev/cv/CV-Erick-Gonzalez-ab12cd34.pdf",
	size: 120 * 1024,
	uploaded: "2026-11-05T12:00:00.000Z",
};

const pdf = (size = 2048, name = "mi-cv.pdf") =>
	new File([new Uint8Array(size)], name, { type: "application/pdf" });

const fileInput = () =>
	screen.getByLabelText("Archivo PDF del currículum") as HTMLInputElement;

describe("cvFileProblem", () => {
	it("acepta un PDF y explica por que rechaza lo demas", () => {
		expect(cvFileProblem({ type: "application/pdf", size: 1000 })).toBeNull();
		expect(cvFileProblem({ type: "image/png", size: 1000 })).toMatch(/PDF/);
		expect(cvFileProblem({ type: "application/pdf", size: 0 })).toMatch(
			/vacío/,
		);
		expect(
			cvFileProblem({ type: "application/pdf", size: 6 * 1024 * 1024 }),
		).toMatch(/máximo/);
	});
});

describe("CvManager", () => {
	it("sin PDF avisa que el boton no se muestra y ofrece elegir uno", () => {
		render(<CvManager initial={null} canUpload />);
		expect(screen.getByText(/no se muestra en el sitio/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Elegir PDF/ })).toBeEnabled();
	});

	it("con PDF muestra el nombre, el tamano y el enlace para abrirlo", () => {
		render(<CvManager initial={CV} canUpload />);
		expect(
			screen.getByText("CV-Erick-Gonzalez-ab12cd34.pdf"),
		).toBeInTheDocument();
		const link = screen.getByRole("link", { name: /Abrir PDF/ });
		expect(link).toHaveAttribute("href", CV.url);
		expect(link).toHaveAttribute("rel", "noopener noreferrer");
		expect(screen.getByRole("button", { name: /Quitar/ })).toBeInTheDocument();
	});

	it("sin la ficha de textos guardada no deja subir y dice por que", () => {
		render(<CvManager initial={null} canUpload={false} />);
		expect(screen.getByText(/Guarda primero los textos/)).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Elegir PDF/ })).toBeDisabled();
	});

	it("si no se pudo leer el PDF actual, lo dice y bloquea la subida", () => {
		render(
			<CvManager
				initial={null}
				canUpload
				unavailable="No se pudo leer el backend."
			/>,
		);
		expect(screen.getByText("No se pudo leer el backend.")).toBeInTheDocument();
		expect(screen.getByRole("button", { name: /Elegir PDF/ })).toBeDisabled();
	});

	it("rechaza un archivo que no es PDF sin subirlo", async () => {
		render(<CvManager initial={null} canUpload />);
		await userEvent.upload(
			fileInput(),
			new File(["x"], "foto.png", { type: "image/png" }),
			{ applyAccept: false },
		);
		expect(
			await screen.findByText("Elige un archivo PDF."),
		).toBeInTheDocument();
		expect(apiUploadCv).not.toHaveBeenCalled();
	});

	it("elige un PDF, lo sube y muestra el nuevo", async () => {
		vi.mocked(apiUploadCv).mockResolvedValue({
			...CV,
			uploaded: "2026-11-05T13:00:00.000Z",
		});
		render(<CvManager initial={null} canUpload />);
		await userEvent.upload(fileInput(), pdf());
		await userEvent.click(
			await screen.findByRole("button", { name: "Subir PDF" }),
		);
		await waitFor(() =>
			expect(
				screen.getByText("CV-Erick-Gonzalez-ab12cd34.pdf"),
			).toBeInTheDocument(),
		);
		expect(apiUploadCv).toHaveBeenCalledTimes(1);
	});

	it("si la subida falla muestra el mensaje y deja intentar de nuevo", async () => {
		vi.mocked(apiUploadCv).mockRejectedValue(
			new ApiFailure(
				409,
				"Guarda primero los textos del sitio y después sube el currículum.",
			),
		);
		render(<CvManager initial={null} canUpload />);
		await userEvent.upload(fileInput(), pdf());
		await userEvent.click(
			await screen.findByRole("button", { name: "Subir PDF" }),
		);
		expect(
			await screen.findByText(/Guarda primero los textos del sitio y después/),
		).toBeInTheDocument();
		expect(screen.getByRole("button", { name: "Subir PDF" })).toBeEnabled();
	});

	it("quitar pide confirmacion y deja el sitio sin PDF", async () => {
		vi.mocked(api.delete).mockResolvedValue(null);
		render(<CvManager initial={CV} canUpload />);
		await userEvent.click(screen.getByRole("button", { name: /Quitar/ }));
		expect(
			await screen.findByText(/dejará de mostrarse en el sitio/),
		).toBeInTheDocument();
		expect(api.delete).not.toHaveBeenCalled();
		await userEvent.click(screen.getByRole("button", { name: "Quitar" }));
		await waitFor(() => expect(api.delete).toHaveBeenCalledWith("/api/cv"));
		expect(
			await screen.findByText(/no se muestra en el sitio/),
		).toBeInTheDocument();
	});
});
