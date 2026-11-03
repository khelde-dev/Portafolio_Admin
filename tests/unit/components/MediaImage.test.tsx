// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MediaImage } from "@/components/media/MediaImage";

vi.mock("astro:env/client", () => ({
	PUBLIC_MEDIA_URL: "https://media.example.dev",
	PUBLIC_ICONS_URL: "https://icons.example.dev/api/icons",
}));

describe("MediaImage", () => {
	it("pinta la imagen del bucket con su URL publica", () => {
		render(<MediaImage mediaKey="gcp.webp" alt="Logo" />);
		expect(screen.getByAltText("Logo")).toHaveAttribute(
			"src",
			"https://media.example.dev/gcp.webp",
		);
	});

	it("si el archivo no existe, avisa con texto y no deja un icono roto", () => {
		const { container } = render(
			<MediaImage mediaKey="UPVM.webp" alt="Logo" showLabel />,
		);
		fireEvent.error(screen.getByAltText("Logo"));
		expect(container.querySelector("img")).toBeNull();
		expect(screen.getByText("No está en R2")).toBeInTheDocument();
		expect(
			screen.getByTitle("No se encontró «UPVM.webp» en R2"),
		).toBeInTheDocument();
	});

	it("en miniaturas el aviso va solo para lectores de pantalla", () => {
		render(<MediaImage mediaKey="a.webp" alt="x" />);
		fireEvent.error(screen.getByAltText("x"));
		expect(screen.getByText("No se encontró a.webp en R2")).toHaveClass(
			"sr-only",
		);
	});

	it("al cambiar de clave vuelve a intentarlo", () => {
		const { rerender } = render(<MediaImage mediaKey="a.webp" alt="x" />);
		fireEvent.error(screen.getByAltText("x"));
		rerender(<MediaImage mediaKey="b.webp" alt="x" />);
		expect(screen.getByAltText("x")).toHaveAttribute(
			"src",
			"https://media.example.dev/b.webp",
		);
	});
});
