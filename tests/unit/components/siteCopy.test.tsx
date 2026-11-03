// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { usageHref } from "@/components/media/mediaTypes";
import { SiteCopyForm } from "@/components/site/SiteCopyForm";
import { describeEntry } from "@/lib/activity";
import { api } from "@/lib/apiClient";
import { siteCopyValues } from "@/lib/contentForms";
import { NAV } from "@/lib/nav";
import { UPLOAD_USES } from "@/lib/webp";
import { type SiteCopyRow, siteCopySchema } from "@/schemas/siteCopy";
import { findResource } from "@/server/resources";

vi.mock("astro:env/client", () => ({
	PUBLIC_MEDIA_URL: "https://media.example.dev",
	PUBLIC_ICONS_URL: "https://icons.example.dev/api/icons",
}));
vi.mock("react-hot-toast", () => ({ default: { success: vi.fn() } }));

const row: SiteCopyRow = {
	site_copy_id: 1,
	hero_image: "Aboutme.webp",
	hero_image_alt_default: "Retrato de Erick",
	hero_label_default: "Desarrollador Full-Stack",
	hero_lead_default: "Presentación",
	manifesto_text_default: "Manifiesto",
	meta_description_default: "Descripción",
	translations: { en: { hero_label: "Full-stack Developer" } },
	created_at: "2026-01-01 00:00:00",
	updated_at: "2026-01-01 10:00:00",
};

beforeEach(() => vi.restoreAllMocks());

describe("siteCopySchema", () => {
	const valid = {
		hero_image: "site/a.webp",
		hero_image_alt_default: "Retrato",
		hero_label_default: "Dev",
		hero_lead_default: "Hola",
		manifesto_text_default: "Frase",
		meta_description_default: "Descripción",
	};

	it("acepta datos validos", () => {
		expect(siteCopySchema.safeParse(valid).success).toBe(true);
	});

	it("pide cada dato y no deja pasar una URL como imagen", () => {
		const empty = siteCopySchema.safeParse({});
		expect(empty.success).toBe(false);
		for (const hero_image of ["https://evil.example/x.webp", "../x.webp", ""]) {
			expect(siteCopySchema.safeParse({ ...valid, hero_image }).success).toBe(
				false,
			);
		}
	});

	it("respeta los limites del backend", () => {
		expect(
			siteCopySchema.safeParse({ ...valid, hero_lead_default: "x".repeat(501) })
				.success,
		).toBe(false);
		expect(
			siteCopySchema.safeParse({
				...valid,
				meta_description_default: "x".repeat(301),
			}).success,
		).toBe(false);
	});
});

describe("registro en el admin", () => {
	it("la ruta es una ficha unica que solo se edita", () => {
		expect(findResource("site-copy")).toMatchObject({
			listPath: "/site-copy/admin",
			basePath: "/site-copy",
			update: true,
			singleton: true,
		});
		expect(findResource("site-copy")?.remove).toBeFalsy();
	});

	it("el menu tiene Textos, la foto del hero se sube a su carpeta, y Actividad y Medios saben llegar", () => {
		const group = NAV.find((g) => g.label === "Sitio");
		expect(group?.items.map((i) => i.id)).toContain("textos");
		expect(UPLOAD_USES.site.folder).toBe("site");
		expect(
			describeEntry({
				id: 1,
				at: "2026-01-01 00:00:00",
				admin_email: "x",
				action: "update",
				resource: "site-copy",
				resource_id: "1",
				summary: null,
			}),
		).toMatchObject({ label: "textos del sitio", href: "/textos" });
		expect(
			usageHref({
				resource: "site-copy",
				id: 1,
				label: "Textos del sitio",
				field: "hero_image",
			}),
		).toBe("/textos");
	});
});

describe("SiteCopyForm", () => {
	it("carga la ficha, con su version y las traducciones", () => {
		expect(siteCopyValues(row)).toMatchObject({
			updated_at: "2026-01-01 10:00:00",
			hero_image: "Aboutme.webp",
			translations: { en: { hero_label: "Full-stack Developer" } },
		});
		expect(siteCopyValues(null)).toMatchObject({
			hero_image: "",
			hero_label_default: "",
		});
		expect(siteCopyValues(null)).not.toHaveProperty("updated_at");
	});

	it("guarda con PUT /api/site-copy y manda la version leida", async () => {
		const put = vi.spyOn(api, "put").mockResolvedValue(null);
		render(<SiteCopyForm initial={row} />);
		const lead = screen.getByLabelText(/^Presentación del hero/);
		await userEvent.clear(lead);
		await userEvent.type(lead, "Nueva presentación");
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		await waitFor(() => expect(put).toHaveBeenCalledOnce());
		expect(put.mock.calls[0][0]).toBe("/api/site-copy");
		expect(put.mock.calls[0][1]).toMatchObject({
			updated_at: "2026-01-01 10:00:00",
			hero_image: "Aboutme.webp",
			hero_lead_default: "Nueva presentación",
		});
	});

	it("sin ficha arranca vacia y avisa que falta", async () => {
		const put = vi.spyOn(api, "put");
		render(<SiteCopyForm initial={null} />);
		await userEvent.click(
			screen.getByRole("button", { name: "Guardar cambios" }),
		);
		expect(
			await screen.findByText("La foto del hero es obligatoria"),
		).toBeInTheDocument();
		expect(put).not.toHaveBeenCalled();
	});

	it("el selector de la foto abre en la URL y ofrece cambiarla", async () => {
		vi.spyOn(api, "get").mockResolvedValue({ objects: [], truncated: false });
		render(<SiteCopyForm initial={row} />);
		await userEvent.click(screen.getByRole("button", { name: /Cambiar foto/ }));
		expect(window.location.search).toBe("?elegir=hero_image");
		expect(await screen.findByRole("dialog")).toBeInTheDocument();
	});
});
