// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	applyThemePref,
	isDarkFor,
	readThemePref,
	saveThemePref,
	watchSystemTheme,
} from "@/lib/theme";

const mockMedia = (matches: boolean) => {
	const listeners = new Set<() => void>();
	const media = {
		matches,
		addEventListener: (_: string, fn: () => void) => listeners.add(fn),
		removeEventListener: (_: string, fn: () => void) => listeners.delete(fn),
	};
	vi.stubGlobal("matchMedia", () => media);
	window.matchMedia = (() => media) as unknown as typeof window.matchMedia;
	return { media, listeners };
};

beforeEach(() => {
	localStorage.clear();
	document.documentElement.className = "";
	document.documentElement.style.colorScheme = "";
});
afterEach(() => vi.unstubAllGlobals());

describe("tema", () => {
	it("sin valor guardado sigue al sistema", () => {
		expect(readThemePref()).toBe("system");
	});

	it("solo acepta light y dark; cualquier otra cosa es sistema", () => {
		localStorage.setItem("theme", "dark");
		expect(readThemePref()).toBe("dark");
		localStorage.setItem("theme", "morado");
		expect(readThemePref()).toBe("system");
	});

	it("isDarkFor: la preferencia manda; sistema usa el del SO", () => {
		expect(isDarkFor("light", true)).toBe(false);
		expect(isDarkFor("dark", false)).toBe(true);
		expect(isDarkFor("system", true)).toBe(true);
		expect(isDarkFor("system", false)).toBe(false);
	});

	it("aplica la clase dark y el color-scheme", () => {
		mockMedia(false);
		expect(applyThemePref("dark")).toBe(true);
		expect(document.documentElement.classList.contains("dark")).toBe(true);
		expect(document.documentElement.style.colorScheme).toBe("dark");
		expect(applyThemePref("light")).toBe(false);
		expect(document.documentElement.classList.contains("dark")).toBe(false);
	});

	it("Sistema toma el valor del sistema operativo", () => {
		mockMedia(true);
		expect(applyThemePref("system")).toBe(true);
	});

	it("guardar Sistema borra el valor; guardar otro lo escribe", () => {
		saveThemePref("dark");
		expect(localStorage.getItem("theme")).toBe("dark");
		saveThemePref("system");
		expect(localStorage.getItem("theme")).toBeNull();
	});

	it("si el almacenamiento falla, no lanza", () => {
		const spy = vi
			.spyOn(Storage.prototype, "getItem")
			.mockImplementation(() => {
				throw new Error("bloqueado");
			});
		expect(readThemePref()).toBe("system");
		spy.mockRestore();
		const set = vi
			.spyOn(Storage.prototype, "setItem")
			.mockImplementation(() => {
				throw new Error("bloqueado");
			});
		expect(() => saveThemePref("dark")).not.toThrow();
		set.mockRestore();
	});

	it("watchSystemTheme avisa y se puede cancelar", () => {
		const { listeners } = mockMedia(false);
		const onChange = vi.fn();
		const stop = watchSystemTheme(onChange);
		expect(listeners.size).toBe(1);
		stop();
		expect(listeners.size).toBe(0);
	});
});
