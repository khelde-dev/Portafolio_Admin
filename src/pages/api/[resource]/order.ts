import type { APIRoute } from "astro";
import { handleResource } from "@/server/proxy";

// Reordenar en lote: `PUT /api/<recurso>/order` con `[{ id, sort_order }]`.
// Esta ruta fija gana a `[id]`, asi que "order" nunca se toma por un id.
export const PUT: APIRoute = (ctx) => handleResource(ctx, "order");
