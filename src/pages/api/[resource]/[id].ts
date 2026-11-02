import type { APIRoute } from "astro";
import { handleResource } from "@/server/proxy";

export const PUT: APIRoute = (ctx) => handleResource(ctx, "update");
export const DELETE: APIRoute = (ctx) => handleResource(ctx, "remove");
