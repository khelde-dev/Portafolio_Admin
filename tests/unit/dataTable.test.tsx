// @vitest-environment jsdom
import {
	act,
	render,
	renderHook,
	screen,
	within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { type Column, DataTable } from "@/components/DataTable";
import { pageWindow } from "@/components/ListPagination";
import { PAGE_SIZES } from "@/components/PageControls";
import { setUrlParams, useUrlParam } from "@/hooks/useUrlParams";
import { choose } from "./helpers/select";

vi.mock("astro:env/client", () => ({
	PUBLIC_MEDIA_URL: "https://media.example.dev",
	PUBLIC_ICONS_URL: "https://icons.example.dev/api/icons",
}));

interface Row {
	id: number;
	name: string;
}
const rows: Row[] = Array.from({ length: 27 }, (_, i) => ({
	id: i + 1,
	name: `Elemento ${String(i + 1).padStart(2, "0")}`,
}));
const columns: Column<Row>[] = [
	{ id: "name", header: "Nombre", cell: (row) => row.name },
];

const renderTable = (
	props: Partial<Parameters<typeof DataTable<Row>>[0]> = {},
) =>
	render(
		<DataTable
			rows={rows}
			getId={(r) => r.id}
			columns={columns}
			label="Elementos"
			searchText={(r) => r.name}
			searchLabel="Buscar elemento"
			empty={<p>vacio</p>}
			{...props}
		/>,
	);

const search = () => window.location.search;

describe("useUrlParam", () => {
	it("lee y escribe un parametro; el valor por defecto no ensucia la URL", () => {
		const { result } = renderHook(() => useUrlParam("estado", "all"));
		expect(result.current[0]).toBe("all");
		act(() => result.current[1]("draft"));
		expect(search()).toBe("?estado=draft");
		expect(result.current[0]).toBe("draft");
		act(() => result.current[1]("all"));
		expect(search()).toBe("");
	});

	it("cambiar un filtro vuelve a la primera pagina", () => {
		setUrlParams({ pagina: "3" });
		const { result } = renderHook(() =>
			useUrlParam("estado", "all", { resetsPage: true }),
		);
		act(() => result.current[1]("draft"));
		expect(search()).toBe("?estado=draft");
	});

	it("un cambio con push se deshace con Atras", () => {
		const { result } = renderHook(() => useUrlParam("borrar"));
		act(() => result.current[1]("7", { push: true }));
		expect(search()).toBe("?borrar=7");
		act(() => {
			window.history.back();
		});
	});

	it("reacciona a popstate (Atras/Adelante del navegador)", () => {
		const { result } = renderHook(() => useUrlParam("buscar"));
		act(() => {
			window.history.replaceState(null, "", "/?buscar=hola");
			window.dispatchEvent(new PopStateEvent("popstate"));
		});
		expect(result.current[0]).toBe("hola");
	});
});

describe("pageWindow", () => {
	it("muestra primera, ultima y vecinas, con huecos", () => {
		expect(pageWindow(1, 3)).toEqual([1, 2, 3]);
		expect(pageWindow(5, 10)).toEqual([1, null, 4, 5, 6, null, 10]);
		expect(pageWindow(1, 10)).toEqual([1, 2, null, 10]);
		expect(pageWindow(10, 10)).toEqual([1, null, 9, 10]);
	});
});

describe("DataTable", () => {
	it("pagina de 10 en 10 por defecto y dice en que pagina esta", () => {
		renderTable();
		const table = screen.getByRole("table", { name: "Elementos" });
		expect(within(table).getAllByRole("row")).toHaveLength(11); // encabezado + 10
		expect(screen.getByText("27 elementos, página 1 de 3")).toBeInTheDocument();
	});

	it("las paginas son enlaces con la URL de cada una; elegir una cambia la URL", async () => {
		renderTable();
		const next = screen.getByRole("link", { name: "Ir a la página 2" });
		expect(next).toHaveAttribute("href", "/?pagina=2");
		await userEvent.click(next);
		expect(search()).toBe("?pagina=2");
		expect(screen.getByText("Elemento 11")).toBeInTheDocument();
		expect(screen.queryByText("Elemento 01")).toBeNull();
		expect(
			screen.getByRole("link", { name: "Ir a la página 2" }),
		).toHaveAttribute("aria-current", "page");
		await userEvent.click(
			screen.getByRole("link", { name: "Ir a la página siguiente" }),
		);
		expect(search()).toBe("?pagina=3");
		expect(screen.getByText("Elemento 27")).toBeInTheDocument();
	});

	it("abre en la pagina que dice la URL (se puede compartir o recargar)", () => {
		window.history.replaceState(null, "", "/?pagina=3");
		renderTable();
		expect(screen.getByText("Elemento 21")).toBeInTheDocument();
		expect(screen.queryByText("Elemento 20")).toBeNull();
	});

	it("una pagina fuera de rango o rara cae en una valida", () => {
		window.history.replaceState(null, "", "/?pagina=99");
		const { unmount } = renderTable();
		expect(screen.getByText("Elemento 27")).toBeInTheDocument();
		unmount();
		window.history.replaceState(null, "", "/?pagina=abc");
		renderTable();
		expect(screen.getByText("Elemento 01")).toBeInTheDocument();
	});

	it("ofrece 5, 10, 25, 50 y 100 filas por pagina y lo deja en la URL", async () => {
		expect(PAGE_SIZES).toEqual([5, 10, 25, 50, 100]);
		renderTable();
		await userEvent.click(screen.getByLabelText("Filas por página"));
		const options = (await screen.findAllByRole("option")).map(
			(o) => o.textContent,
		);
		expect(options).toEqual(["5", "10", "25", "50", "100"]);
		await userEvent.click(screen.getByRole("option", { name: "25" }));
		expect(search()).toBe("?por=25");
		expect(screen.getByText("27 elementos, página 1 de 2")).toBeInTheDocument();
	});

	it("cambiar el tamano vuelve a la primera pagina; el 10 no ensucia la URL", async () => {
		window.history.replaceState(null, "", "/?pagina=3");
		renderTable();
		await choose("Filas por página", "5");
		expect(search()).toBe("?por=5");
		await choose("Filas por página", "10");
		expect(search()).toBe("");
	});

	it("un tamano que no esta en la lista se ignora", () => {
		window.history.replaceState(null, "", "/?por=7");
		renderTable();
		expect(screen.getByText("27 elementos, página 1 de 3")).toBeInTheDocument();
	});

	it("la busqueda queda en la URL y lleva a la primera pagina", async () => {
		window.history.replaceState(null, "", "/?pagina=2");
		renderTable();
		await userEvent.type(
			screen.getByLabelText("Buscar elemento"),
			"Elemento 2",
		);
		expect(search()).toBe("?buscar=Elemento+2");
		expect(screen.getByText("8 elementos de 27")).toBeInTheDocument();
	});

	it("abre con la busqueda de la URL ya aplicada", () => {
		window.history.replaceState(null, "", "/?buscar=Elemento%2005");
		renderTable();
		expect(screen.getByText("1 elemento de 27")).toBeInTheDocument();
		expect(screen.getByLabelText("Buscar elemento")).toHaveValue("Elemento 05");
	});

	it("sin filas y sin filtros muestra el vacio", () => {
		renderTable({ rows: [], filters: undefined });
		expect(screen.getByText("vacio")).toBeInTheDocument();
	});

	it("un filtro que deja cero filas conserva los filtros para poder quitarlo", () => {
		renderTable({
			rows: [],
			filters: <button type="button">Todos</button>,
		});
		expect(screen.getByRole("button", { name: "Todos" })).toBeInTheDocument();
		expect(screen.getByText("Nada coincide")).toBeInTheDocument();
		expect(screen.queryByText("vacio")).toBeNull();
	});
});
