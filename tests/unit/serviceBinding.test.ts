import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("astro:env/server", () => ({
	BACKEND_URL: "https://api.example.dev/api",
	API_SECRET_TOKEN: "test-token-value",
}));

// El binding vive en `cloudflare:workers`, que solo existe en el runtime de Cloudflare.
const workersEnv: Record<string, unknown> = {};
vi.mock("cloudflare:workers", () => ({ env: workersEnv }));

const { backendChannel, callBackend, serviceBinding } = await import(
	"@/server/backendClient"
);

const ok = () => Response.json({ data: [] });

beforeEach(() => {
	for (const key of Object.keys(workersEnv)) delete workersEnv[key];
});
afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
});

describe("Service Binding hacia el backend", () => {
	it("en `pnpm dev` nunca se usa (no hay Worker del backend al que unirse)", async () => {
		workersEnv.BACKEND = { fetch: vi.fn() };
		vi.stubEnv("DEV", true);
		expect(await serviceBinding()).toBeNull();
		expect(await backendChannel()).toBe("url");
	});

	it("desplegado y con el binding: la llamada pasa por el, sin tocar el fetch publico", async () => {
		vi.stubEnv("DEV", false);
		const binding = { fetch: vi.fn().mockResolvedValue(ok()) };
		workersEnv.BACKEND = binding;
		const publicFetch = vi.fn();
		vi.stubGlobal("fetch", publicFetch);

		expect(await backendChannel()).toBe("binding");
		await callBackend("/projects/admin", { accessJwt: "jwt-1" });

		expect(publicFetch).not.toHaveBeenCalled();
		const [url, init] = binding.fetch.mock.calls[0];
		// La ruta es la misma; el host no importa dentro de Cloudflare.
		expect(url).toBe("https://api.example.dev/api/projects/admin");
		// El token y la sesion de Access viajan igual que por la URL publica.
		expect(init.headers).toMatchObject({
			Authorization: "Bearer test-token-value",
			"Cf-Access-Jwt-Assertion": "jwt-1",
		});
	});

	it("desplegado sin el binding configurado: usa la URL publica", async () => {
		vi.stubEnv("DEV", false);
		const publicFetch = vi.fn().mockResolvedValue(ok());
		vi.stubGlobal("fetch", publicFetch);
		expect(await backendChannel()).toBe("url");
		await callBackend("/projects/admin", { accessJwt: "jwt-1" });
		expect(publicFetch).toHaveBeenCalledOnce();
	});

	it("algo que no es un binding (sin fetch) se ignora", async () => {
		vi.stubEnv("DEV", false);
		workersEnv.BACKEND = "texto";
		expect(await serviceBinding()).toBeNull();
		workersEnv.BACKEND = {};
		expect(await serviceBinding()).toBeNull();
	});

	it("si el binding falla no se cae a la URL publica a escondidas: el error sale", async () => {
		vi.stubEnv("DEV", false);
		workersEnv.BACKEND = {
			fetch: vi.fn().mockRejectedValue(new TypeError("binding caido")),
		};
		const publicFetch = vi.fn().mockResolvedValue(ok());
		vi.stubGlobal("fetch", publicFetch);
		await expect(callBackend("/x", { accessJwt: "j" })).rejects.toThrow(
			"binding caido",
		);
		expect(publicFetch).not.toHaveBeenCalled();
	});

	it("los errores del backend por el binding se tratan igual (409, 401…)", async () => {
		vi.stubEnv("DEV", false);
		workersEnv.BACKEND = {
			fetch: vi
				.fn()
				.mockResolvedValue(
					Response.json({ message: "Invalid token" }, { status: 401 }),
				),
		};
		await expect(callBackend("/x", { accessJwt: "j" })).rejects.toMatchObject({
			status: 401,
			reason: "bearer",
		});
	});
});
