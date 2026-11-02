import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("esqueleto del admin", () => {
	test("la portada carga con un solo h1 y sin pantalla de acceso", async ({
		page,
	}) => {
		await page.goto("/");
		await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
		// La identidad la pone Cloudflare Access, no un formulario propio.
		await expect(page.locator("input[type=password]")).toHaveCount(0);
	});

	test("no se deja indexar", async ({ page, request }) => {
		const response = await page.goto("/");
		expect(response?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
			"content",
			"noindex, nofollow",
		);
		const robots = await request.get("/robots.txt");
		expect(await robots.text()).toContain("Disallow: /");
	});

	test("manda las cabeceras de seguridad", async ({ page }) => {
		const headers = (await page.goto("/"))?.headers() ?? {};
		expect(headers["x-frame-options"]).toBe("DENY");
		expect(headers["x-content-type-options"]).toBe("nosniff");
		expect(headers["cache-control"]).toBe("private, no-store");
	});

	test("cumple WCAG 2.1 AA (axe)", async ({ page }) => {
		await page.goto("/");
		const results = await new AxeBuilder({ page })
			.withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
			.analyze();
		expect(results.violations).toEqual([]);
	});
});
