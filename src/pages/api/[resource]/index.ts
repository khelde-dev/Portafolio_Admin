import type { APIRoute } from "astro";
import { handleResource } from "@/server/proxy";

// El middleware ya verifico la identidad (Access); aqui solo se enruta.
export const GET: APIRoute = (ctx) => handleResource(ctx, "list");
export const POST: APIRoute = (ctx) => handleResource(ctx, "create");
// Solo los recursos de una sola fila (`about`) aceptan PUT sin id.
export const PUT: APIRoute = (ctx) => handleResource(ctx, "update");
