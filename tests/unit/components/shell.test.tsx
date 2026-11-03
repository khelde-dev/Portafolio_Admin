// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LocalTime } from "@/components/LocalTime";
import { MobileNav } from "@/components/MobileNav";
import { NavList } from "@/components/NavList";
import { EmptyState, ErrorState, ListSkeleton } from "@/components/states";
import { ThemeMenu } from "@/components/ThemeMenu";

beforeEach(() => {
	localStorage.clear();
	document.documentElement.className = "";
	window.matchMedia = ((query: string) => ({
		matches: false,
		media: query,
		addEventListener: () => {},
		removeEventListener: () => {},
	})) as unknown as typeof window.matchMedia;
});

describe("NavList", () => {
	it("marca solo el elemento activo con aria-current", () => {
		render(<NavList activeId="proyectos" />);
		const current = screen
			.getAllByRole("link")
			.filter((a) => a.getAttribute("aria-current") === "page");
		expect(current).toHaveLength(1);
		expect(current[0]).toHaveTextContent("Proyectos");
	});

	it("tiene un menu con nombre y enlaces reales a cada modulo", () => {
		render(<NavList activeId="panel" />);
		expect(
			screen.getByRole("navigation", { name: "Principal" }),
		).toBeInTheDocument();
		expect(screen.getByRole("link", { name: /Mensajes/ })).toHaveAttribute(
			"href",
			"/mensajes",
		);
	});

	it("muestra el globo con texto para lectores y tope en 99+", () => {
		render(
			<NavList activeId="panel" badges={{ mensajes: 3, comentarios: 250 }} />,
		);
		expect(screen.getByRole("link", { name: /Mensajes/ })).toHaveTextContent(
			"3",
		);
		expect(screen.getByRole("link", { name: /Comentarios/ })).toHaveTextContent(
			"99+",
		);
		expect(screen.getAllByText("Sin atender:", { exact: false })).toHaveLength(
			2,
		);
	});

	it("sin globo cuando el numero es 0", () => {
		render(<NavList activeId="panel" badges={{ mensajes: 0 }} />);
		expect(screen.queryByText("Sin atender:", { exact: false })).toBeNull();
	});
});

describe("MobileNav", () => {
	it("abre el menu con el mismo contenido", async () => {
		render(<MobileNav activeId="panel" />);
		await userEvent.click(
			screen.getByRole("button", { name: "Abrir el menú" }),
		);
		expect(
			await screen.findByRole("link", { name: /Proyectos/ }),
		).toBeInTheDocument();
	});
});

describe("ThemeMenu", () => {
	it("empieza en Sistema y cambia a Oscuro, guardando y aplicando la clase", async () => {
		render(<ThemeMenu />);
		const trigger = screen.getByRole("button", { name: /Tema: Sistema/ });
		await userEvent.click(trigger);
		await userEvent.click(
			await screen.findByRole("menuitem", { name: /Oscuro/ }),
		);
		await waitFor(() => expect(localStorage.getItem("theme")).toBe("dark"));
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(
			screen.getByRole("button", { name: /Tema: Oscuro/ }),
		).toBeInTheDocument();
	});

	it("recupera la preferencia guardada", async () => {
		localStorage.setItem("theme", "light");
		render(<ThemeMenu />);
		expect(
			await screen.findByRole("button", { name: /Tema: Claro/ }),
		).toBeInTheDocument();
	});
});

describe("estados", () => {
	it("EmptyState invita a actuar", () => {
		render(
			<EmptyState
				title="Todavía no hay proyectos"
				description="Crea el primero."
			>
				<a href="/proyectos/nuevo">Nuevo proyecto</a>
			</EmptyState>,
		);
		expect(screen.getByText("Todavía no hay proyectos")).toBeInTheDocument();
		expect(
			screen.getByRole("link", { name: "Nuevo proyecto" }),
		).toBeInTheDocument();
	});

	it("ErrorState es una alerta y reintenta", () => {
		const retry = vi.fn();
		render(<ErrorState title="No se pudo cargar" onRetry={retry} />);
		expect(screen.getByRole("alert")).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
		expect(retry).toHaveBeenCalledOnce();
	});

	it("ListSkeleton anuncia la carga y nunca usa un spinner", () => {
		const { container } = render(<ListSkeleton rows={3} />);
		expect(
			screen.getByRole("status", { name: "Cargando" }),
		).toBeInTheDocument();
		expect(container.querySelectorAll("[data-slot=skeleton]").length).toBe(3);
		expect(container.innerHTML).not.toContain("animate-spin");
	});
});

describe("LocalTime", () => {
	it("pinta una fecha legible y la etiqueta <time>", async () => {
		render(<LocalTime value="2026-11-02 14:05:00" />);
		const time = await screen.findByText(/2026/);
		expect(time.tagName).toBe("TIME");
		expect(time).toHaveAttribute("datetime", "2026-11-02T14:05:00.000Z");
	});

	it("sin fecha muestra una raya", () => {
		render(<LocalTime value={null} />);
		expect(screen.getByText("—")).toBeInTheDocument();
	});
});
