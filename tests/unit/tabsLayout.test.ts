import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
	readFileSync(join(import.meta.dirname, "../..", path), "utf8");

describe("pestanas en movil", () => {
	it("la variante `line` no fija la altura de la lista (si no, la 2a fila se encima al formulario)", () => {
		const tabs = read("src/components/ui/tabs.tsx");
		expect(tabs).toMatch(/line:[^\n]*group-data-horizontal\/tabs:h-auto/);
	});

	it("ninguna lista de pestanas intenta anular el `h-8` con un `h-auto` suelto", () => {
		for (const file of [
			"src/components/form/TranslationsTabs.tsx",
			"src/components/CommentsApp.tsx",
			"src/components/media/ImagePicker.tsx",
		]) {
			expect(read(file)).not.toMatch(/className="h-auto/);
		}
	});

	it("el input oculto del cargador vive dentro de un contenedor relativo", () => {
		const uploader = read("src/components/media/ImageUploader.tsx");
		expect(uploader).toMatch(
			/<div className="relative">\s*<Input\s+id=\{inputId\}\s+type="file"/,
		);
	});
});
