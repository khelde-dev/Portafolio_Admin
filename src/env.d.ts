/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

/** Bindings del Worker (wrangler.jsonc); solo existen en el runtime de Cloudflare. */
declare module "cloudflare:workers" {
	export const env: Record<string, unknown>;
}

declare namespace App {
	interface Locals {
		/** Usuario verificado por Cloudflare Access (lo pone src/middleware.ts). */
		user: import("./server/access").AccessUser;
	}
}
