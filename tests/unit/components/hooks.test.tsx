// @vitest-environment jsdom
import {
	act,
	render,
	renderHook,
	screen,
	waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormSection } from "@/components/form/FormSection";
import { ToastHost } from "@/components/ToastHost";
import { useResource } from "@/hooks/useResource";
import { ApiFailure, api } from "@/lib/apiClient";

afterEach(() => vi.restoreAllMocks());

describe("useResource", () => {
	it("con datos iniciales no pide nada al montar", () => {
		const get = vi.spyOn(api, "get");
		const { result } = renderHook(() => useResource("/api/x", [1]));
		expect(result.current.data).toEqual([1]);
		expect(result.current.loading).toBe(false);
		expect(get).not.toHaveBeenCalled();
	});

	it("sin datos iniciales los pide, y reload los refresca", async () => {
		const get = vi
			.spyOn(api, "get")
			.mockResolvedValueOnce(["a"])
			.mockResolvedValueOnce(["a", "b"]);
		const { result } = renderHook(() => useResource<string[]>("/api/x"));
		expect(result.current.loading).toBe(true);
		await waitFor(() => expect(result.current.data).toEqual(["a"]));
		await act(async () => {
			await result.current.reload();
		});
		expect(result.current.data).toEqual(["a", "b"]);
		expect(get).toHaveBeenCalledTimes(2);
	});

	it("un fallo conserva los datos anteriores y expone el error", async () => {
		vi.spyOn(api, "get").mockRejectedValue(
			new ApiFailure(502, "El backend respondió con un error."),
		);
		const { result } = renderHook(() =>
			useResource<string[]>("/api/x", ["viejo"]),
		);
		await act(async () => {
			await result.current.reload();
		});
		expect(result.current.error?.status).toBe(502);
		expect(result.current.data).toEqual(["viejo"]);
		expect(result.current.loading).toBe(false);
	});

	it("un error que no es de la API se convierte en un mensaje generico", async () => {
		vi.spyOn(api, "get").mockRejectedValue(new Error("raro"));
		const { result } = renderHook(() => useResource<string[]>("/api/x", []));
		await act(async () => {
			await result.current.reload();
		});
		expect(result.current.error?.message).toBe(
			"No se pudo cargar. Intenta de nuevo.",
		);
	});

	it("ignora una respuesta vieja que llega despues de una nueva", async () => {
		let resolveFirst: (v: string[]) => void = () => {};
		vi.spyOn(api, "get")
			.mockImplementationOnce(
				() =>
					new Promise((r) => {
						resolveFirst = r as never;
					}),
			)
			.mockResolvedValueOnce(["nueva"]);
		const { result } = renderHook(() => useResource<string[]>("/api/x"));
		await act(async () => {
			await result.current.reload();
		});
		await act(async () => {
			resolveFirst(["vieja"]);
		});
		expect(result.current.data).toEqual(["nueva"]);
	});

	it("setData reemplaza los datos sin pedir nada", () => {
		const { result } = renderHook(() => useResource<string[]>("/api/x", []));
		act(() => result.current.setData(["z"]));
		expect(result.current.data).toEqual(["z"]);
	});
});

describe("api (cliente del navegador)", () => {
	it("get/post/put/delete llaman con el metodo correcto", async () => {
		const fetchMock = vi
			.fn()
			.mockImplementation(() => Promise.resolve(Response.json({ data: 1 })));
		vi.stubGlobal("fetch", fetchMock);
		await api.get("/a");
		await api.post("/a", {});
		await api.put("/a", {});
		await api.delete("/a");
		expect(fetchMock.mock.calls.map((c) => c[1].method)).toEqual([
			"GET",
			"POST",
			"PUT",
			"DELETE",
		]);
		vi.unstubAllGlobals();
	});
});

describe("ToastHost y FormSection", () => {
	it("el contenedor de avisos se monta sin error", () => {
		const { container } = render(<ToastHost />);
		expect(container).toBeTruthy();
	});

	it("FormSection agrupa con un titulo", () => {
		render(
			<FormSection title="Imágenes" description="La tarjeta y la galería">
				<p>campos</p>
			</FormSection>,
		);
		expect(
			screen.getByRole("heading", { name: "Imágenes", level: 2 }),
		).toBeInTheDocument();
		expect(screen.getByText("La tarjeta y la galería")).toBeInTheDocument();
		expect(screen.getByText("campos")).toBeInTheDocument();
	});
});
