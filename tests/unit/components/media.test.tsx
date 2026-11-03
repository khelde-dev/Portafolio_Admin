// @vitest-environment jsdom
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GalleryField, ImagePickerField } from "@/components/media/ImagePicker";
import { ImageUploader } from "@/components/media/ImageUploader";
import { MediaGrid } from "@/components/media/MediaGrid";
import { MediaLibrary } from "@/components/media/MediaLibrary";
import {
	keyToPath,
	type MediaObject,
	shortKey,
	usageHref,
} from "@/components/media/mediaTypes";
import { ApiFailure, api, apiUpload } from "@/lib/apiClient";
import { ImageError, type WebpResult } from "@/lib/webp";

vi.mock("astro:env/client", () => ({
	PUBLIC_MEDIA_URL: "https://media.example.dev",
}));

const object = (over: Partial<MediaObject> = {}): MediaObject => ({
	key: "projects/a.webp",
	size: 150 * 1024,
	uploaded: "2026-11-02T14:05:00.000Z",
	usedBy: [],
	...over,
});

beforeEach(() => {
	URL.createObjectURL = vi.fn(() => "blob:preview");
	URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

const result = (): WebpResult => ({
	blob: new Blob([new Uint8Array(50 * 1024)], { type: "image/webp" }),
	width: 1280,
	height: 640,
	originalBytes: 2 * 1024 * 1024,
	quality: 0.82,
});

describe("ayudas de medios", () => {
	it("usageHref lleva a la pantalla de cada recurso", () => {
		expect(
			usageHref({
				resource: "projects",
				id: 3,
				label: "x",
				field: "card_image",
			}),
		).toBe("/proyectos/3");
		expect(
			usageHref({ resource: "experiences", id: 2, label: "x", field: "img" }),
		).toBe("/experiencia/2");
		expect(
			usageHref({ resource: "education", id: 1, label: "x", field: "image" }),
		).toBe("/educacion/1");
		expect(
			usageHref({ resource: "about", id: 1, label: "x", field: "image" }),
		).toBe("/sobre-mi");
		expect(
			usageHref({ resource: "raro", id: 1, label: "x", field: "x" }),
		).toBeNull();
	});
	it("shortKey y keyToPath", () => {
		expect(
			shortKey("projects/6f1c9d2e-aaaa-bbbb-cccc-1234567890ab.webp"),
		).toMatch(/^….{27}$/);
		expect(shortKey("a.webp")).toBe("a.webp");
		expect(keyToPath("a/b c.webp")).toBe("a/b%20c.webp");
	});
});

describe("ImageUploader", () => {
	const pick = async (file: File) => {
		const input = document.querySelector(
			"input[type=file]",
		) as HTMLInputElement;
		await userEvent.upload(input, file);
	};
	const file = () => new File(["x"], "foto.png", { type: "image/png" });

	it("convierte, muestra antes y despues, y sube solo al confirmar", async () => {
		const onUploaded = vi.fn();
		const convert = vi.fn().mockResolvedValue(result());
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue(
				Response.json(
					{
						data: {
							key: "projects/n.webp",
							url: null,
							size: 1,
							width: 1,
							height: 1,
						},
					},
					{ status: 201 },
				),
			),
		);
		render(
			<ImageUploader use="card" onUploaded={onUploaded} convert={convert} />,
		);
		await pick(file());
		expect(
			await screen.findByText(/2.0 MB a 50 KB, 1280 × 640 px/),
		).toBeInTheDocument();
		expect(screen.getByAltText("Vista previa de foto.png")).toBeInTheDocument();
		expect(onUploaded).not.toHaveBeenCalled();
		await userEvent.click(screen.getByRole("button", { name: "Subir imagen" }));
		await waitFor(() =>
			expect(onUploaded).toHaveBeenCalledWith(
				expect.objectContaining({ key: "projects/n.webp" }),
			),
		);
		const init = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
		expect(init[0]).toBe("/api/media?use=projects");
		expect(init[1].headers["Content-Type"]).toBe("image/webp");
		vi.unstubAllGlobals();
	});

	it("un error de conversion se explica y no sube nada", async () => {
		const convert = vi
			.fn()
			.mockRejectedValue(new ImageError("Este navegador no puede crear WebP."));
		render(<ImageUploader use="card" onUploaded={vi.fn()} convert={convert} />);
		await pick(file());
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"Este navegador no puede crear WebP.",
		);
		expect(screen.queryByRole("button", { name: "Subir imagen" })).toBeNull();
	});

	it("un fallo al subir deja reintentar", async () => {
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					Response.json(
						{ message: "La imagen supera los 2 MB" },
						{ status: 413 },
					),
				),
		);
		render(
			<ImageUploader
				use="card"
				onUploaded={vi.fn()}
				convert={vi.fn().mockResolvedValue(result())}
			/>,
		);
		await pick(file());
		await userEvent.click(
			await screen.findByRole("button", { name: "Subir imagen" }),
		);
		expect(await screen.findByRole("alert")).toHaveTextContent(
			"La imagen supera los 2 MB",
		);
		expect(screen.getByRole("button", { name: "Subir imagen" })).toBeEnabled();
		vi.unstubAllGlobals();
	});

	it("Elegir otra vuelve al inicio", async () => {
		render(
			<ImageUploader
				use="card"
				onUploaded={vi.fn()}
				convert={vi.fn().mockResolvedValue(result())}
			/>,
		);
		await pick(file());
		await userEvent.click(
			await screen.findByRole("button", { name: /Elegir otra/ }),
		);
		expect(screen.queryByAltText(/Vista previa/)).toBeNull();
	});

	it("dice los topes de su uso", () => {
		render(<ImageUploader use="logo" onUploaded={vi.fn()} />);
		expect(
			screen.getByText(/Logo de experiencia.*120 KB y 512 px/),
		).toBeInTheDocument();
	});
});

describe("apiUpload", () => {
	it("un fallo de red sugiere recargar", async () => {
		const fetcher = vi.fn().mockRejectedValue(new TypeError("x"));
		await expect(
			apiUpload("projects", new Blob(["x"]), fetcher),
		).rejects.toMatchObject({ status: 0 });
	});
});

describe("MediaGrid", () => {
	it("muestra clave, peso y donde se usa; la huerfana dice Sin uso", () => {
		render(
			<MediaGrid
				label="Imágenes"
				objects={[
					object({
						usedBy: [
							{
								resource: "projects",
								id: 3,
								label: "Mi proyecto",
								field: "card_image",
							},
						],
					}),
					object({ key: "projects/b.webp" }),
				]}
			/>,
		);
		expect(
			screen.getByRole("link", { name: "Mi proyecto (tarjeta)" }),
		).toHaveAttribute("href", "/proyectos/3");
		expect(screen.getByText("Sin uso")).toBeInTheDocument();
		expect(screen.getAllByText(/150 KB/).length).toBe(2);
	});

	it("con onPick, la miniatura es un boton que elige", async () => {
		const onPick = vi.fn();
		render(
			<MediaGrid
				label="x"
				objects={[object()]}
				onPick={onPick}
				selectedKey="projects/a.webp"
			/>,
		);
		const button = screen.getByRole("button", {
			name: "Elegir projects/a.webp",
		});
		expect(button).toHaveAttribute("aria-pressed", "true");
		await userEvent.click(button);
		expect(onPick).toHaveBeenCalledWith(
			expect.objectContaining({ key: "projects/a.webp" }),
		);
	});
});

describe("MediaLibrary", () => {
	it("vacio invita a subir; error con reintento", async () => {
		const { unmount } = render(
			<MediaLibrary initial={{ objects: [], truncated: false }} />,
		);
		expect(screen.getByText("Todavía no hay imágenes")).toBeInTheDocument();
		unmount();
		vi.spyOn(api, "get").mockResolvedValue({
			objects: [object()],
			truncated: false,
		});
		render(
			<MediaLibrary
				initial={null}
				initialError="No se pudo leer el backend."
			/>,
		);
		await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
		expect(await screen.findByText("projects/a.webp")).toBeInTheDocument();
	});

	it("filtra las imagenes sin uso y solo esas se pueden borrar", async () => {
		render(
			<MediaLibrary
				initial={{
					objects: [
						object({
							usedBy: [
								{
									resource: "projects",
									id: 1,
									label: "P",
									field: "card_image",
								},
							],
						}),
						object({ key: "projects/huerfana.webp" }),
					],
					truncated: false,
				}}
			/>,
		);
		expect(screen.getAllByRole("button", { name: /Borrar/ })).toHaveLength(1);
		await userEvent.click(screen.getByRole("button", { name: /Sin uso 1/ }));
		const list = screen.getByRole("list", { name: "Imágenes" });
		expect(
			within(list).getByText("projects/huerfana.webp"),
		).toBeInTheDocument();
		expect(within(list).queryByText("projects/a.webp")).toBeNull();
	});

	it("borrar pide confirmacion y quita la imagen", async () => {
		const del = vi.spyOn(api, "delete").mockResolvedValue(null);
		render(
			<MediaLibrary
				initial={{
					objects: [object({ key: "projects/mi imagen.webp" })],
					truncated: false,
				}}
			/>,
		);
		await userEvent.click(screen.getByRole("button", { name: /Borrar/ }));
		await userEvent.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Borrar",
			}),
		);
		await waitFor(() =>
			expect(del).toHaveBeenCalledWith("/api/media/projects/mi%20imagen.webp"),
		);
		await waitFor(() =>
			expect(screen.queryByText("projects/mi imagen.webp")).toBeNull(),
		);
	});

	it("un 409 (alguien la uso) avisa y refresca la lista", async () => {
		vi.spyOn(api, "delete").mockRejectedValue(
			new ApiFailure(409, "La imagen está en uso."),
		);
		const get = vi.spyOn(api, "get").mockResolvedValue({
			objects: [
				object({
					usedBy: [
						{ resource: "projects", id: 1, label: "P", field: "gallery" },
					],
				}),
			],
			truncated: false,
		});
		render(
			<MediaLibrary initial={{ objects: [object()], truncated: false }} />,
		);
		await userEvent.click(screen.getByRole("button", { name: /Borrar/ }));
		await userEvent.click(
			within(await screen.findByRole("alertdialog")).getByRole("button", {
				name: "Borrar",
			}),
		);
		expect(
			await screen.findByText("La imagen está en uso."),
		).toBeInTheDocument();
		await waitFor(() => expect(get).toHaveBeenCalled());
		await waitFor(() =>
			expect(screen.queryByRole("button", { name: /Borrar/ })).toBeNull(),
		);
	});

	it("avisa cuando hay mas imagenes de las que se listan", () => {
		render(<MediaLibrary initial={{ objects: [object()], truncated: true }} />);
		expect(screen.getByText(/primeras 5 000/)).toBeInTheDocument();
	});
});

describe("campos de imagen en un formulario", () => {
	const Host = ({
		children,
		values,
	}: {
		children: React.ReactNode;
		values: Record<string, unknown>;
	}) => {
		const form = useForm({ defaultValues: values });
		return (
			<FormProvider {...form}>
				<output data-testid="value">{JSON.stringify(form.watch())}</output>
				{children}
			</FormProvider>
		);
	};
	const stubLibrary = () =>
		vi.spyOn(api, "get").mockResolvedValue({
			objects: [object({ key: "projects/b.webp" })],
			truncated: false,
		});

	it("ImagePickerField muestra la actual y elige de la biblioteca", async () => {
		stubLibrary();
		render(
			<Host values={{ card_image: "projects/a.webp" }}>
				<ImagePickerField
					name="card_image"
					label="Imagen de la tarjeta"
					use="card"
				/>
			</Host>,
		);
		expect(
			screen.getByAltText("Imagen actual: projects/a.webp"),
		).toHaveAttribute("src", "https://media.example.dev/projects/a.webp");
		await userEvent.click(
			screen.getByRole("button", { name: /^Cambiar imagen de la tarjeta/ }),
		);
		await userEvent.click(
			await screen.findByRole("tab", { name: "Biblioteca" }),
		);
		await userEvent.click(
			await screen.findByRole("button", { name: "Elegir projects/b.webp" }),
		);
		await waitFor(() =>
			expect(screen.getByTestId("value")).toHaveTextContent("projects/b.webp"),
		);
	});

	it("sin imagen invita a elegir una", () => {
		render(
			<Host values={{ card_image: "" }}>
				<ImagePickerField
					name="card_image"
					label="Imagen"
					use="card"
					required
				/>
			</Host>,
		);
		expect(
			screen.getByRole("button", { name: /^Elegir imagen/ }),
		).toBeInTheDocument();
		expect(screen.getByText("Sin imagen")).toBeInTheDocument();
	});

	it("GalleryField agrega, reordena y quita", async () => {
		stubLibrary();
		render(
			<Host values={{ gallery: ["a.webp", "c.webp"] }}>
				<GalleryField name="gallery" label="Galería" use="gallery" />
			</Host>,
		);
		await userEvent.click(screen.getByRole("button", { name: "Bajar a.webp" }));
		expect(
			JSON.parse(screen.getByTestId("value").textContent ?? "{}").gallery,
		).toEqual(["c.webp", "a.webp"]);
		expect(screen.getByRole("button", { name: "Subir c.webp" })).toBeDisabled();
		await userEvent.click(
			screen.getByRole("button", { name: "Quitar c.webp de la galería" }),
		);
		expect(
			JSON.parse(screen.getByTestId("value").textContent ?? "{}").gallery,
		).toEqual(["a.webp"]);

		await userEvent.click(
			screen.getByRole("button", { name: /Agregar imagen/ }),
		);
		await userEvent.click(
			await screen.findByRole("tab", { name: "Biblioteca" }),
		);
		await userEvent.click(
			await screen.findByRole("button", { name: "Elegir projects/b.webp" }),
		);
		await waitFor(() =>
			expect(
				JSON.parse(screen.getByTestId("value").textContent ?? "{}").gallery,
			).toEqual(["a.webp", "projects/b.webp"]),
		);
	});

	it("una galeria vacia lo dice", () => {
		render(
			<Host values={{ gallery: [] }}>
				<GalleryField name="gallery" label="Galería" use="gallery" />
			</Host>,
		);
		expect(
			screen.getByText("Todavía no hay imágenes en la galería."),
		).toBeInTheDocument();
	});
});
