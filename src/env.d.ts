/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />

declare namespace App {
	interface Locals {
		/** Usuario verificado por Cloudflare Access (lo pone src/middleware.ts). */
		user: import("./server/access").AccessUser;
	}
}
