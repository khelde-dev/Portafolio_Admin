import type { APIRoute } from "astro";
import { listMedia, uploadMedia } from "@/server/mediaProxy";

// Rutas fijas: ganan a `/api/[resource]`, asi "media" nunca se toma por un recurso.
export const GET: APIRoute = (ctx) => listMedia(ctx);
export const POST: APIRoute = (ctx) => uploadMedia(ctx);
