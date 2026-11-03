import { describe, expect, it, vi } from "vitest";
import {
	isSameOrigin,
	MAX_BODY_BYTES,
	readJsonBody,
} from "@/lib/requestGuards";
import { normalizeTeam } from "@/server/access";

const handle = vi.hoisted(() =>
	vi.fn(async (_ctx: unknown, op: string) => new Response(op)),
);
vi.mock("@/server/proxy", () => ({ handleResource: handle }));

const index = await import("@/pages/api/[resource]/index");
const byId = await import("@/pages/api/[resource]/[id]");
const order = await import("@/pages/api/[resource]/order");
const robots = await import("@/pages/robots.txt");

const run = async (fn: unknown) =>
	(await (fn as (c: unknown) => Promise<Response>)({})).text();

describe("rutas /api/[resource]", () => {
	it("cada metodo HTTP se traduce a la operacion correcta", async () => {
		expect(await run(index.GET)).toBe("list");
		expect(await run(index.POST)).toBe("create");
		expect(await run(index.PUT)).toBe("update");
		expect(await run(byId.PUT)).toBe("update");
		expect(await run(byId.DELETE)).toBe("remove");
		expect(await run(order.PUT)).toBe("order");
	});

	it("no expone mas metodos de los previstos", () => {
		expect(Object.keys(index).sort()).toEqual(["GET", "POST", "PUT"]);
		expect(Object.keys(byId).sort()).toEqual(["DELETE", "PUT"]);
		expect(Object.keys(order)).toEqual(["PUT"]);
	});
});

describe("robots.txt", () => {
	it("bloquea todo", async () => {
		const res = robots.GET({} as never) as Response;
		expect(await res.text()).toContain("Disallow: /");
		expect(res.headers.get("Content-Type")).toContain("text/plain");
	});
});

describe("isSameOrigin", () => {
	const req = (headers: Record<string, string>) =>
		new Request("http://x/api", { method: "POST", headers });
	it("Origin manda sobre todo lo demas", () => {
		expect(
			isSameOrigin(req({ origin: "http://localhost" }), "http://localhost"),
		).toBe(true);
		expect(
			isSameOrigin(req({ origin: "https://malo.example" }), "http://localhost"),
		).toBe(false);
		expect(
			isSameOrigin(
				req({
					origin: "https://malo.example",
					"sec-fetch-site": "same-origin",
				}),
				"http://localhost",
			),
		).toBe(false);
	});
	it("sin Origin usa Sec-Fetch-Site", () => {
		expect(
			isSameOrigin(req({ "sec-fetch-site": "cross-site" }), "http://localhost"),
		).toBe(false);
		expect(
			isSameOrigin(req({ "sec-fetch-site": "same-site" }), "http://localhost"),
		).toBe(false);
		expect(
			isSameOrigin(
				req({ "sec-fetch-site": "same-origin" }),
				"http://localhost",
			),
		).toBe(true);
		expect(isSameOrigin(req({}), "http://localhost")).toBe(true);
	});
});

describe("readJsonBody", () => {
	const post = (
		body: string,
		headers: Record<string, string> = { "content-type": "application/json" },
	) => new Request("http://x/api", { method: "POST", headers, body });

	it("lee un JSON valido (con charset)", async () => {
		const r = await readJsonBody(
			post('{"a":1}', { "content-type": "application/json; charset=utf-8" }),
		);
		expect(r).toEqual({ ok: true, value: { a: 1 } });
	});
	it("415 si no es JSON", async () => {
		expect(
			await readJsonBody(post("x", { "content-type": "text/plain" })),
		).toMatchObject({ status: 415 });
		expect(await readJsonBody(post("x", {}))).toMatchObject({ status: 415 });
	});
	it("413 por Content-Length declarado y por tamano real", async () => {
		const big = "x".repeat(MAX_BODY_BYTES + 1);
		expect(
			await readJsonBody(
				post("{}", {
					"content-type": "application/json",
					"content-length": String(MAX_BODY_BYTES + 1),
				}),
			),
		).toMatchObject({ status: 413 });
		expect(await readJsonBody(post(JSON.stringify({ big })))).toMatchObject({
			status: 413,
		});
	});
	it("400 si el JSON esta roto", async () => {
		expect(await readJsonBody(post("{roto"))).toMatchObject({ status: 400 });
	});
});

describe("normalizeTeam", () => {
	it("acepta con o sin esquema y con o sin barra", () => {
		const want = "https://throbbing-lake-8623.cloudflareaccess.com";
		expect(normalizeTeam(want)).toBe(want);
		expect(normalizeTeam(`${want}/`)).toBe(want);
		expect(normalizeTeam("throbbing-lake-8623.cloudflareaccess.com")).toBe(
			want,
		);
		expect(normalizeTeam(`  ${want}  `)).toBe(want);
	});
});
