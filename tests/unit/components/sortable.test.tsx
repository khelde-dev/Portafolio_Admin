// @vitest-environment jsdom
import { act, render, renderHook, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { OrderIntro } from "@/components/OrderControls";
import { SortableList } from "@/components/SortableList";
import { useReorder } from "@/hooks/useReorder";

vi.mock("@/components/Toaster", () => ({ toast: { success: vi.fn() } }));

interface Row {
	id: number;
	name: string;
}

const rows: Row[] = [
	{ id: 1, name: "Alfa" },
	{ id: 2, name: "Beta" },
	{ id: 3, name: "Gamma" },
];

const renderList = (onMoveTo = vi.fn()) => {
	render(
		<SortableList
			rows={rows}
			getId={(row) => row.id}
			getTitle={(row) => row.name}
			describe={(row) => `datos de ${row.name}`}
			onMoveTo={onMoveTo}
			label="Orden de pruebas"
		/>,
	);
	return onMoveTo;
};

describe("SortableList", () => {
	it("es una lista ordenada con posicion, asa y datos de cada elemento", () => {
		renderList();
		const list = screen.getByRole("list", { name: "Orden de pruebas" });
		expect(list.tagName).toBe("OL");
		expect(screen.getAllByRole("listitem")).toHaveLength(3);
		expect(screen.getByText("datos de Beta")).toBeInTheDocument();
		for (const row of rows) {
			expect(
				screen.getByRole("button", { name: `Mover ${row.name}` }),
			).toBeInTheDocument();
		}
	});

	it("el asa avisa que se puede ordenar y explica el teclado en espanol", () => {
		renderList();
		const handle = screen.getByRole("button", { name: "Mover Alfa" });
		expect(handle).toHaveAttribute("aria-roledescription", "sortable");
		const instructions = document.getElementById(
			handle.getAttribute("aria-describedby") ?? "",
		);
		expect(instructions).toHaveTextContent(/barra espaciadora/);
		expect(instructions).toHaveTextContent(/Escape cancela/);
	});

	it("Subir y Bajar son la alternativa sin arrastrar", async () => {
		const onMoveTo = renderList();
		expect(screen.getByRole("button", { name: "Subir Alfa" })).toBeDisabled();
		expect(screen.getByRole("button", { name: "Bajar Gamma" })).toBeDisabled();
		await userEvent.click(screen.getByRole("button", { name: "Bajar Alfa" }));
		expect(onMoveTo).toHaveBeenCalledWith(0, 1);
		await userEvent.click(screen.getByRole("button", { name: "Subir Gamma" }));
		expect(onMoveTo).toHaveBeenCalledWith(2, 1);
	});

	it("no escribe estilos en la pagina (un CSP con hashes no lo permitiria)", () => {
		const before = document.querySelectorAll("style").length;
		renderList();
		expect(document.querySelectorAll("style")).toHaveLength(before);
	});
});

describe("OrderIntro", () => {
	it("dice cuantos se ordenan y como, y sale del modo", async () => {
		const onToggle = vi.fn();
		render(
			<OrderIntro count={21} noun="proyectos" active onToggle={onToggle} />,
		);
		expect(screen.getByText(/Ordenando 21 proyectos/)).toBeInTheDocument();
		await userEvent.click(
			screen.getByRole("button", { name: "Terminar de ordenar" }),
		);
		expect(onToggle).toHaveBeenCalledTimes(1);
	});
});

describe("useReorder.moveTo", () => {
	it("lleva un elemento a cualquier posicion y lo marca como cambiado", () => {
		const { result } = renderHook(() =>
			useReorder(rows, (row) => row.id, "skills"),
		);
		expect(result.current.dirty).toBe(false);
		act(() => result.current.moveTo(0, 2));
		expect(result.current.rows.map((row) => row.name)).toEqual([
			"Beta",
			"Gamma",
			"Alfa",
		]);
		expect(result.current.dirty).toBe(true);
		act(() => result.current.moveTo(2, 0));
		expect(result.current.dirty).toBe(false);
	});

	it("ignora posiciones fuera de la lista", () => {
		const { result } = renderHook(() =>
			useReorder(rows, (row) => row.id, "skills"),
		);
		act(() => result.current.moveTo(0, 9));
		expect(result.current.rows).toEqual(rows);
	});
});
