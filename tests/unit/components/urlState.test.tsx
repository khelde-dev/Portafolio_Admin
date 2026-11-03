// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";
import { CommentsApp } from "@/components/CommentsApp";
import { TranslationsTabs } from "@/components/form/TranslationsTabs";
import { MobileNav } from "@/components/MobileNav";
import { ImagePickerField } from "@/components/media/ImagePicker";
import { MediaLibrary } from "@/components/media/MediaLibrary";
import type { MediaObject } from "@/components/media/mediaTypes";
import { api } from "@/lib/apiClient";
import type { CommentRow } from "@/schemas/inbox";

vi.mock("astro:env/client", () => ({
	PUBLIC_MEDIA_URL: "https://media.example.dev",
	PUBLIC_ICONS_URL: "https://icons.example.dev/api/icons",
}));

const search = () => window.location.search;

const comment = (over: Partial<CommentRow> = {}): CommentRow => ({
	comment_id: 1,
	name: "Luis",
	job: "Dev",
	description: "Excelente trabajo.",
	direction: "left",
	country: "México",
	country_flag: "mx",
	status: "pending",
	created_at: "2026-11-02",
	updated_at: "2026-11-02",
	...over,
});

const object = (key: string, used = false): MediaObject => ({
	key,
	size: 1024,
	uploaded: "2026-11-02T14:05:00.000Z",
	usedBy: used
		? [{ resource: "projects", id: 1, label: "Alfa", field: "card_image" }]
		: [],
});

describe("comentarios: la pestaña y el modal viven en la URL", () => {
	it("la pestana (?estado), la busqueda y el borrado", async () => {
		render(
			<CommentsApp
				initial={[
					comment(),
					comment({ comment_id: 2, name: "Ana", status: "hidden" }),
				]}
			/>,
		);
		await userEvent.click(screen.getByRole("tab", { name: /Oculto/ }));
		expect(search()).toBe("?estado=hidden");
		await userEvent.click(screen.getByRole("button", { name: /Borrar/ }));
		expect(search()).toBe("?estado=hidden&borrar=2");
		expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
		expect(search()).toBe("?estado=hidden");
		await userEvent.click(screen.getByRole("tab", { name: /Pendiente/ }));
		expect(search()).toBe("");
	});

	it("abre en la pestana que dice la URL", () => {
		window.history.replaceState(null, "", "/?estado=hidden");
		render(
			<CommentsApp
				initial={[
					comment(),
					comment({ comment_id: 2, name: "Ana", status: "hidden" }),
				]}
			/>,
		);
		expect(screen.getByRole("tab", { name: /Oculto/ })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		expect(screen.getByText("Ana")).toBeInTheDocument();
	});
});

describe("Medios: filtro, pagina y modal en la URL", () => {
	const listing = {
		objects: Array.from({ length: 12 }, (_, i) =>
			object(`projects/${String(i).padStart(2, "0")}.webp`, i % 2 === 0),
		),
		truncated: false,
	};

	it("pagina la biblioteca y el filtro 'sin uso' queda en la URL", async () => {
		render(<MediaLibrary initial={listing} />);
		expect(
			screen.getByRole("link", { name: "Ir a la página 2" }),
		).toBeInTheDocument();
		await userEvent.click(
			screen.getByRole("link", { name: "Ir a la página 2" }),
		);
		expect(search()).toBe("?pagina=2");
		await userEvent.click(screen.getByRole("button", { name: /Sin uso/ }));
		expect(search()).toBe("?ver=unused");
	});

	it("el modal de borrar una imagen vive en la URL con su clave", async () => {
		render(
			<MediaLibrary
				initial={{ objects: [object("projects/sola.webp")], truncated: false }}
			/>,
		);
		await userEvent.click(screen.getByRole("button", { name: /Borrar/ }));
		expect(search()).toBe("?borrar=projects%2Fsola.webp");
		expect(await screen.findByRole("alertdialog")).toHaveTextContent(
			"projects/sola.webp",
		);
		await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
		expect(search()).toBe("");
	});

	it("abre con el tipo de subida de la URL y un valor raro cae al por defecto", () => {
		window.history.replaceState(null, "", "/?tipo=about");
		const { unmount } = render(<MediaLibrary initial={listing} />);
		expect(screen.getByLabelText("¿Para qué es?")).toHaveTextContent(
			/Sobre mí/,
		);
		unmount();
		window.history.replaceState(null, "", "/?tipo=__proto__");
		render(<MediaLibrary initial={listing} />);
		expect(screen.getByLabelText("¿Para qué es?")).toHaveTextContent(
			/Tarjeta de proyecto/,
		);
	});
});

describe("selector de imagen: el dialogo y su pestana en la URL", () => {
	const Wrapper = () => {
		const form = useForm({ defaultValues: { img: "" } });
		return (
			<FormProvider {...form}>
				<ImagePickerField name="img" label="Logo" use="logo" />
			</FormProvider>
		);
	};

	it("?elegir=<campo> abre el dialogo; Cerrar lo quita", async () => {
		vi.spyOn(api, "get").mockResolvedValue({ objects: [], truncated: false });
		render(<Wrapper />);
		await userEvent.click(screen.getByRole("button", { name: /Elegir logo/ }));
		expect(search()).toBe("?elegir=img");
		const dialog = await screen.findByRole("dialog");
		await userEvent.click(
			within(dialog).getByRole("tab", { name: "Biblioteca" }),
		);
		expect(search()).toBe("?elegir=img&origen=library");
		await userEvent.keyboard("{Escape}");
		// Cerrar quita el dialogo y tambien su pestana: la URL queda limpia.
		expect(search()).toBe("");
	});

	it("abre directo desde la URL", async () => {
		vi.spyOn(api, "get").mockResolvedValue({ objects: [], truncated: false });
		window.history.replaceState(null, "", "/?elegir=img");
		render(<Wrapper />);
		expect(await screen.findByRole("dialog")).toBeInTheDocument();
	});

	it("la URL de otro campo no abre este", () => {
		window.history.replaceState(null, "", "/?elegir=otro");
		render(<Wrapper />);
		expect(screen.queryByRole("dialog")).toBeNull();
	});
});

describe("menu movil y pestanas de idioma", () => {
	it("el panel del menu vive en la URL (?menu=abierto)", async () => {
		render(<MobileNav activeId="panel" />);
		await userEvent.click(
			screen.getByRole("button", { name: "Abrir el menú" }),
		);
		expect(search()).toBe("?menu=abierto");
		expect(await screen.findByRole("dialog")).toBeInTheDocument();
		await userEvent.keyboard("{Escape}");
		expect(search()).toBe("");
	});

	const Tabs = () => {
		const form = useForm({ defaultValues: { title: "", translations: {} } });
		return (
			<FormProvider {...form}>
				<TranslationsTabs
					spanish={<p>base</p>}
					fields={[{ name: "title", label: "Título", baseName: "title" }]}
				/>
			</FormProvider>
		);
	};

	it("el idioma que se edita queda en ?idioma", async () => {
		render(<Tabs />);
		await userEvent.click(screen.getByRole("tab", { name: /Francés/ }));
		expect(search()).toBe("?idioma=fr");
		await userEvent.click(screen.getByRole("tab", { name: /Español/ }));
		expect(search()).toBe("");
	});

	it("abre en el idioma de la URL y uno raro cae en español", () => {
		window.history.replaceState(null, "", "/?idioma=en");
		const { unmount } = render(<Tabs />);
		expect(screen.getByRole("tab", { name: /Inglés/ })).toHaveAttribute(
			"aria-selected",
			"true",
		);
		unmount();
		window.history.replaceState(null, "", "/?idioma=zz");
		render(<Tabs />);
		expect(screen.getByRole("tab", { name: /Español/ })).toHaveAttribute(
			"aria-selected",
			"true",
		);
	});
});
