// @vitest-environment jsdom
import {
	act,
	render,
	renderHook,
	screen,
	waitFor,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FormProvider, useForm } from "react-hook-form";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TechPicker } from "@/components/form/TechPicker";
import { MoveButtons, OrderBar } from "@/components/OrderControls";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { ProjectsApp } from "@/components/projects/ProjectsApp";
import { useReorder } from "@/hooks/useReorder";
import { ApiFailure, api } from "@/lib/apiClient";
import type { ProjectRow } from "@/schemas/projects";

vi.mock("astro:env/client", () => ({
	PUBLIC_MEDIA_URL: "https://media.example.dev",
	PUBLIC_ICONS_URL: "https://icons.example.dev/api/icons",
}));
vi.mock("@/components/Toaster", () => ({ toast: { success: vi.fn() } }));

import { toast } from "@/components/Toaster";

const project = (over: Partial<ProjectRow> = {}): ProjectRow => ({
	project_id: 1,
	slug: "alfa",
	category: "frontend",
	status: "published",
	featured: false,
	sort_order: 0,
	card_image: "projects/a.webp",
	gallery: [],
	video_url: null,
	images_topics: ["react"],
	link_repo: null,
	link_web: null,
	fork: false,
	title_default: "Alfa",
	summary_default: "Resumen",
	description_default: "Descripción",
	translations: {},
	created_at: "2026-01-01 00:00:00",
	updated_at: "2026-02-01 00:00:00",
	...over,
});

beforeEach(() => {
	vi.clearAllMocks();
	window.history.replaceState(null, "", "/");
});
afterEach(() => vi.restoreAllMocks());

describe("useReorder", () => {
	const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];

	it("mueve, detecta el cambio y guarda posiciones 0..n", async () => {
		const put = vi.spyOn(api, "put").mockResolvedValue(null);
		const { result } = renderHook(() =>
			useReorder(rows, (r) => r.id, "skills"),
		);
		expect(result.current.dirty).toBe(false);
		act(() => result.current.move(0, 1));
		expect(result.current.rows.map((r) => r.id)).toEqual([2, 1, 3]);
		expect(result.current.dirty).toBe(true);
		await act(async () => {
			await result.current.save();
		});
		expect(put).toHaveBeenCalledWith("/api/skills/order", [
			{ id: 2, sort_order: 0 },
			{ id: 1, sort_order: 1 },
			{ id: 3, sort_order: 2 },
		]);
		expect(result.current.dirty).toBe(false);
		expect(toast.success).toHaveBeenCalledWith("Orden guardado");
	});

	it("un fallo conserva el orden y lo dice; descartar vuelve al guardado", async () => {
		vi.spyOn(api, "put").mockRejectedValue(
			new ApiFailure(502, "El backend rechazó la petición."),
		);
		const { result } = renderHook(() =>
			useReorder(rows, (r) => r.id, "skills"),
		);
		act(() => result.current.move(2, -1));
		await act(async () => {
			await result.current.save();
		});
		expect(result.current.error).toBe("El backend rechazó la petición.");
		expect(result.current.dirty).toBe(true);
		act(() => result.current.discard());
		expect(result.current.rows.map((r) => r.id)).toEqual([1, 2, 3]);
		expect(result.current.error).toBeNull();
	});

	it("replace toma la lista nueva como la guardada", () => {
		const { result } = renderHook(() =>
			useReorder(rows, (r) => r.id, "skills"),
		);
		act(() => result.current.move(0, 1));
		act(() => result.current.replace([{ id: 9 }]));
		expect(result.current.rows).toEqual([{ id: 9 }]);
		expect(result.current.dirty).toBe(false);
	});
});

describe("OrderControls", () => {
	it("los botones dicen a quien mueven y se desactivan en los bordes", async () => {
		const onMove = vi.fn();
		const { rerender } = render(
			<MoveButtons name="Alfa" index={0} count={3} onMove={onMove} />,
		);
		expect(screen.getByRole("button", { name: "Subir Alfa" })).toBeDisabled();
		await userEvent.click(screen.getByRole("button", { name: "Bajar Alfa" }));
		expect(onMove).toHaveBeenCalledWith(1);
		rerender(<MoveButtons name="Alfa" index={2} count={3} onMove={onMove} />);
		expect(screen.getByRole("button", { name: "Bajar Alfa" })).toBeDisabled();
	});

	it("la barra solo aparece cuando hay cambios o error", () => {
		const props = { saving: false, onSave: vi.fn(), onDiscard: vi.fn() };
		const { container, rerender } = render(
			<OrderBar dirty={false} error={null} {...props} />,
		);
		expect(container).toBeEmptyDOMElement();
		rerender(<OrderBar dirty error={null} {...props} />);
		expect(screen.getByRole("button", { name: "Guardar orden" })).toBeEnabled();
		rerender(<OrderBar dirty={false} error="No se pudo" {...props} />);
		expect(screen.getByRole("alert")).toHaveTextContent("No se pudo");
	});
});

describe("TechPicker", () => {
	const Host = ({ initial = [] as string[] }) => {
		const form = useForm({ defaultValues: { images_topics: initial } });
		return (
			<FormProvider {...form}>
				<output data-testid="v">
					{JSON.stringify(form.watch("images_topics"))}
				</output>
				<TechPicker name="images_topics" label="Tecnologías" />
			</FormProvider>
		);
	};
	const value = () => JSON.parse(screen.getByTestId("v").textContent ?? "[]");

	it("agrega una sugerida y la quita", async () => {
		render(<Host />);
		await userEvent.type(screen.getByRole("searchbox"), "node");
		await userEvent.click(screen.getByRole("button", { name: /nodejs/ }));
		expect(value()).toEqual(["nodejs"]);
		await userEvent.click(
			screen.getByRole("button", { name: "Quitar nodejs" }),
		);
		expect(value()).toEqual([]);
	});

	it("una ya elegida no se vuelve a sugerir", () => {
		render(<Host initial={["react"]} />);
		const list = screen.getByRole("list", { name: "Sugerencias" });
		expect(within(list).queryByRole("button", { name: /^react$/ })).toBeNull();
	});

	it("permite agregar otra valida con vista previa, y avisa si el nombre no sirve", async () => {
		render(<Host />);
		await userEvent.type(screen.getByRole("searchbox"), "zig");
		await userEvent.click(
			await screen.findByRole("button", { name: /Agregar otra: zig/ }),
		);
		expect(value()).toEqual(["zig"]);
		await userEvent.type(screen.getByRole("searchbox"), "Nombre Raro!");
		expect(
			await screen.findByText(/Usa minúsculas, números/),
		).toBeInTheDocument();
		expect(screen.queryByRole("button", { name: /Agregar otra/ })).toBeNull();
	});

	it("muestra el conjunto elegido como una sola imagen", () => {
		render(<Host initial={["git", "docker"]} />);
		expect(screen.getByAltText("Vista previa: git, docker")).toHaveAttribute(
			"src",
			"https://icons.example.dev/api/icons?i=git,docker",
		);
	});

	it("el icono se pide al servicio con el nombre codificado", () => {
		render(<Host initial={["react"]} />);
		const imgs = Array.from(document.querySelectorAll("img"));
		expect(
			imgs.some(
				(i) =>
					i.getAttribute("src") ===
					"https://icons.example.dev/api/icons?i=react",
			),
		).toBe(true);
	});
});

describe("ProjectsApp", () => {
	const two = [
		project(),
		project({
			project_id: 2,
			slug: "beta",
			title_default: "Beta",
			status: "draft",
			category: "backend",
			featured: true,
		}),
	];

	it("sin proyectos invita a crear el primero", () => {
		render(<ProjectsApp initial={[]} siteUrl="https://site.example.dev" />);
		expect(
			screen.getByRole("link", { name: /Nuevo proyecto/ }),
		).toHaveAttribute("href", "/proyectos/nuevo");
	});

	it("muestra el estado con palabras y solo ofrece 'ver en el sitio' si esta publicado", () => {
		render(<ProjectsApp initial={two} siteUrl="https://site.example.dev/" />);
		expect(screen.getByText("Publicado")).toBeInTheDocument();
		expect(screen.getByText("Borrador")).toBeInTheDocument();
		expect(screen.getByText("Destacado")).toBeInTheDocument();
		const view = screen.getByRole("link", { name: "Ver Alfa en el sitio" });
		expect(view).toHaveAttribute(
			"href",
			"https://site.example.dev/es/project/alfa",
		);
		expect(view).toHaveAttribute("rel", "noopener noreferrer");
		expect(
			screen.queryByRole("link", { name: "Ver Beta en el sitio" }),
		).toBeNull();
	});

	it("filtra por estado y por categoria; en la tabla ya no hay botones de orden", async () => {
		render(<ProjectsApp initial={two} siteUrl="https://s.dev" />);
		await userEvent.click(screen.getByRole("button", { name: "Borradores" }));
		const list = screen.getByRole("table", { name: "Proyectos" });
		expect(within(list).getByText("Beta")).toBeInTheDocument();
		expect(within(list).queryByText("Alfa")).toBeNull();
		expect(screen.queryByRole("button", { name: /Subir|Bajar/ })).toBeNull();
	});

	it("en Borradores sin borradores los filtros siguen ahi para volver a Todos", async () => {
		const published = [project({ title_default: "Alfa" })];
		render(<ProjectsApp initial={published} siteUrl="https://s.dev" />);
		await userEvent.click(screen.getByRole("button", { name: "Borradores" }));
		expect(screen.getByText("Nada coincide")).toBeInTheDocument();
		// Los filtros no desaparecen: se puede volver.
		await userEvent.click(screen.getByRole("button", { name: "Todos" }));
		expect(screen.getByRole("link", { name: "Alfa" })).toBeInTheDocument();
	});

	it("los filtros quedan en la URL y se pueden abrir desde ella", async () => {
		render(<ProjectsApp initial={two} siteUrl="https://s.dev" />);
		await userEvent.click(screen.getByRole("button", { name: "Borradores" }));
		expect(window.location.search).toBe("?estado=draft");
		await userEvent.click(screen.getByRole("button", { name: "Todos" }));
		expect(window.location.search).toBe("");
	});

	it("abre ya filtrado si la URL trae estado y categoria", () => {
		window.history.replaceState(null, "", "/?estado=draft&categoria=backend");
		render(
			<ProjectsApp
				initial={[
					project({ title_default: "Alfa" }),
					project({
						project_id: 2,
						title_default: "Beta",
						status: "draft",
						category: "backend",
					}),
				]}
				siteUrl="https://s.dev"
			/>,
		);
		const table = screen.getByRole("table", { name: "Proyectos" });
		expect(within(table).getByText("Beta")).toBeInTheDocument();
		expect(within(table).queryByText("Alfa")).toBeNull();
	});

	it("un valor raro en la URL no rompe el filtro", () => {
		window.history.replaceState(null, "", "/?estado=hack&categoria=__proto__");
		render(<ProjectsApp initial={two} siteUrl="https://s.dev" />);
		const table = screen.getByRole("table", { name: "Proyectos" });
		expect(within(table).getByText("Alfa")).toBeInTheDocument();
		expect(within(table).getByText("Beta")).toBeInTheDocument();
	});

	it("el modal de borrar vive en la URL: abre, sobrevive a una recarga y Atras lo cierra", async () => {
		render(<ProjectsApp initial={two} siteUrl="https://s.dev" />);
		await userEvent.click(screen.getByRole("button", { name: "Borrar Beta" }));
		expect(window.location.search).toBe("?borrar=2");
		expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
		await userEvent.click(screen.getByRole("button", { name: "Cancelar" }));
		expect(window.location.search).toBe("");
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});

	it("abre el modal directo desde una URL con ?borrar=<id>", async () => {
		window.history.replaceState(null, "", "/?borrar=2");
		render(<ProjectsApp initial={two} siteUrl="https://s.dev" />);
		expect(await screen.findByRole("alertdialog")).toHaveTextContent("Beta");
	});

	it("un ?borrar= de un proyecto que ya no existe no abre nada", () => {
		window.history.replaceState(null, "", "/?borrar=999");
		render(<ProjectsApp initial={two} siteUrl="https://s.dev" />);
		expect(screen.queryByRole("alertdialog")).toBeNull();
	});

	it("?orden=1 abre el modo ordenar con todos los proyectos, aunque haya filtros", () => {
		window.history.replaceState(null, "", "/?orden=1&estado=draft");
		render(<ProjectsApp initial={two} siteUrl="https://s.dev" />);
		const list = screen.getByRole("list", { name: "Orden de proyectos" });
		expect(within(list).getByText("Alfa")).toBeInTheDocument();
		expect(within(list).getByText("Beta")).toBeInTheDocument();
		expect(screen.queryByRole("table")).toBeNull();
		expect(screen.getByText(/Ordenando 2 proyectos/)).toBeInTheDocument();
	});

	it("Terminar de ordenar vuelve a la tabla", async () => {
		window.history.replaceState(null, "", "/?orden=1");
		render(<ProjectsApp initial={two} siteUrl="https://s.dev" />);
		await userEvent.click(
			screen.getByRole("button", { name: "Terminar de ordenar" }),
		);
		expect(
			screen.getByRole("table", { name: "Proyectos" }),
		).toBeInTheDocument();
		expect(window.location.search).toBe("");
	});

	it("reordena con botones y guarda de una vez", async () => {
		const put = vi.spyOn(api, "put").mockResolvedValue(null);
		render(<ProjectsApp initial={two} siteUrl="https://s.dev" />);
		await userEvent.click(screen.getByRole("button", { name: "Ordenar" }));
		await userEvent.click(screen.getByRole("button", { name: "Bajar Alfa" }));
		await userEvent.click(
			await screen.findByRole("button", { name: "Guardar orden" }),
		);
		expect(put).toHaveBeenCalledWith("/api/projects/order", [
			{ id: 2, sort_order: 0 },
			{ id: 1, sort_order: 1 },
		]);
	});

	it("borrar pide confirmacion con el nombre", async () => {
		const del = vi.spyOn(api, "delete").mockResolvedValue(null);
		render(<ProjectsApp initial={two} siteUrl="https://s.dev" />);
		await userEvent.click(screen.getByRole("button", { name: "Borrar Beta" }));
		expect(await screen.findByText("¿Borrar «Beta»?")).toBeInTheDocument();
		await userEvent.click(
			within(screen.getByRole("alertdialog")).getByRole("button", {
				name: "Borrar",
			}),
		);
		await waitFor(() => expect(del).toHaveBeenCalledWith("/api/projects/2"));
		await waitFor(() => expect(screen.queryByText("Beta")).toBeNull());
	});

	it("duplicar crea un borrador con -copia y recarga la lista", async () => {
		const post = vi.spyOn(api, "post").mockResolvedValue(null);
		vi.spyOn(api, "get").mockResolvedValue([
			...two,
			project({
				project_id: 3,
				slug: "alfa-copia",
				title_default: "Alfa",
				status: "draft",
			}),
		]);
		render(<ProjectsApp initial={two} siteUrl="https://s.dev" />);
		await userEvent.click(
			screen.getByRole("button", { name: "Duplicar Alfa" }),
		);
		await waitFor(() => expect(post).toHaveBeenCalledOnce());
		expect(post.mock.calls[0][1]).toMatchObject({
			slug: "alfa-copia",
			status: "draft",
			featured: false,
		});
		await waitFor(() => expect(screen.getAllByText("Alfa")).toHaveLength(2));
	});

	it("si la copia choca con otro slug, prueba -copia-2", async () => {
		const post = vi
			.spyOn(api, "post")
			.mockRejectedValueOnce(
				new ApiFailure(409, "Ya existe un proyecto con ese slug"),
			)
			.mockResolvedValueOnce(null);
		vi.spyOn(api, "get").mockResolvedValue(two);
		render(<ProjectsApp initial={two} siteUrl="https://s.dev" />);
		await userEvent.click(
			screen.getByRole("button", { name: "Duplicar Alfa" }),
		);
		await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
		expect(post.mock.calls[1][1]).toMatchObject({ slug: "alfa-copia-2" });
	});

	it("un fallo de lectura muestra el error con reintento", async () => {
		vi.spyOn(api, "get").mockResolvedValue(two);
		render(
			<ProjectsApp
				initial={null}
				initialError="No se pudo leer el backend."
				siteUrl="https://s.dev"
			/>,
		);
		await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
		expect(await screen.findByText("Alfa")).toBeInTheDocument();
	});
});

describe("ProjectForm", () => {
	it("un proyecto nuevo nace como borrador y el slug sale del titulo", async () => {
		render(<ProjectForm />);
		expect(screen.getByRole("switch", { name: /Publicado/ })).not.toBeChecked();
		await userEvent.type(
			screen.getByLabelText(/^Título/, {
				selector: "input#campo-title_default",
			}),
			"Mi Proyecto Ñandú",
		);
		await waitFor(() =>
			expect(screen.getByLabelText(/^Slug/)).toHaveValue("mi-proyecto-nandu"),
		);
	});

	it("si se edita el slug a mano deja de seguir al titulo", async () => {
		render(<ProjectForm />);
		const title = screen.getByLabelText(/^Título/, {
			selector: "input#campo-title_default",
		});
		await userEvent.type(title, "Uno");
		const slug = screen.getByLabelText(/^Slug/);
		await userEvent.clear(slug);
		await userEvent.type(slug, "mi-slug");
		await userEvent.type(title, " dos");
		expect(slug).toHaveValue("mi-slug");
	});

	it("al editar carga los valores, las traducciones y envia un PUT con el id", async () => {
		const put = vi.spyOn(api, "put").mockResolvedValue(null);
		render(
			<ProjectForm
				initial={project({
					project_id: 5,
					translations: {
						en: { title: "Alpha", summary: "Sum", description: "Desc" },
					},
				})}
			/>,
		);
		expect(screen.getByLabelText(/^Slug/)).toHaveValue("alfa");
		expect(screen.getByRole("switch", { name: /Publicado/ })).toBeChecked();
		expect(
			screen.getByRole("tab", { name: /Inglés.*completo/ }),
		).toBeInTheDocument();
		await userEvent.type(
			screen.getByLabelText(/^Título/, {
				selector: "input#campo-title_default",
			}),
			" 2",
		);
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		await waitFor(() => expect(put).toHaveBeenCalledOnce());
		expect(put.mock.calls[0][0]).toBe("/api/projects/5");
		expect(put.mock.calls[0][1]).toMatchObject({
			title_default: "Alfa 2",
			translations: [
				{ locale: "en", title: "Alpha", summary: "Sum", description: "Desc" },
			],
		});
	});

	it("un slug repetido (409) se marca en el campo slug", async () => {
		vi.spyOn(api, "put").mockRejectedValue(
			new ApiFailure(409, "Ya existe un proyecto con ese slug", [
				{ path: ["slug"], message: "Ya existe un proyecto con ese slug" },
			]),
		);
		render(<ProjectForm initial={project()} />);
		await userEvent.type(screen.getByLabelText(/^Slug/), "-x");
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		const message = await screen.findByText(
			"Ya existe un proyecto con ese slug",
			{ selector: "p#campo-slug-error" },
		);
		expect(
			screen.getByLabelText(/^Slug/).getAttribute("aria-describedby"),
		).toContain(message.id);
	});

	it("sin imagen de tarjeta ni categoria no envia y explica", async () => {
		const post = vi.spyOn(api, "post");
		render(<ProjectForm />);
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		expect(await screen.findByText("Elige una categoría")).toBeInTheDocument();
		expect(
			screen.getByText("La imagen de la tarjeta es obligatoria"),
		).toBeInTheDocument();
		expect(post).not.toHaveBeenCalled();
	});
});
