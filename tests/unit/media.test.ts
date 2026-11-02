import { describe, expect, it, vi } from "vitest";

vi.mock("astro:env/client", () => ({
	PUBLIC_MEDIA_URL: "https://media.example.dev/",
}));

const { mediaUrl } = await import("@/lib/media");

describe("mediaUrl", () => {
	it("pega la clave al origen de los medios", () => {
		expect(mediaUrl("a/b.webp")).toBe("https://media.example.dev/a/b.webp");
	});

	it("no duplica la barra si la clave empieza con /", () => {
		expect(mediaUrl("///UPVM.webp")).toBe(
			"https://media.example.dev/UPVM.webp",
		);
	});

	it("una clave con // inicial nunca produce una URL de otro host", () => {
		expect(new URL(mediaUrl("//evil.example/x.png")).host).toBe(
			"media.example.dev",
		);
	});
});
