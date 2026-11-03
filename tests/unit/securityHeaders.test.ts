import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import {
	DYNAMIC_HEADERS,
	SECURITY_HEADERS,
	withSecurityHeaders,
} from "@/lib/securityHeaders";

vi.mock("astro:middleware", () => ({
	defineMiddleware: <T>(fn: T) => fn,
}));
vi.mock("astro:env/server", () => ({
	ACCESS_AUD: "",
	ACCESS_TEAM_DOMAIN: "",
	ADMIN_EMAILS: undefined,
}));

const { onRequest } = await import("@/middleware");

const run = async (response = new Response("page")) =>
	(await (
		onRequest as unknown as (c: unknown, n: unknown) => Promise<Response>
	)(
		{
			url: new URL("http://localhost/"),
			request: new Request("http://localhost/"),
			locals: {},
		},
		vi.fn().mockResolvedValue(response),
	)) as Response;

describe("cabeceras de seguridad", () => {
	it("el middleware las pone todas, incluida la de no indexar", async () => {
		const res = await run();
		for (const [name, value] of Object.entries({
			...SECURITY_HEADERS,
			...DYNAMIC_HEADERS,
		})) {
			expect(res.headers.get(name), name).toBe(value);
		}
		expect(res.headers.get("X-Robots-Tag")).toBe("noindex, nofollow");
		expect(res.headers.get("Cache-Control")).toBe("private, no-store");
	});

	it("respeta una cabecera que la ruta ya definio", async () => {
		const res = await run(
			new Response("x", { headers: { "Cache-Control": "max-age=60" } }),
		);
		expect(res.headers.get("Cache-Control")).toBe("max-age=60");
	});

	it("funciona con cabeceras inmutables (respuesta de un fetch)", () => {
		const res = withSecurityHeaders(
			Response.redirect("http://localhost/x", 302),
		);
		expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
		expect(res.status).toBe(302);
	});

	it("public/_headers lista exactamente las cabeceras compartidas", () => {
		const file = readFileSync("public/_headers", "utf8");
		const listed = Object.fromEntries(
			file
				.split("\n")
				.filter((line) => /^\s+[A-Za-z-]+:\s/.test(line))
				.map((line) => {
					const [name, ...rest] = line.trim().split(":");
					return [name, rest.join(":").trim()];
				}),
		);
		expect(listed).toEqual(SECURITY_HEADERS);
	});

	it("los archivos estaticos con hash no llevan no-store", () => {
		expect(readFileSync("public/_headers", "utf8")).not.toContain("no-store");
	});
});
