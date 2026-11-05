import type { APIRoute } from "astro";
import { deleteCv, getCv, uploadCv } from "@/server/cvProxy";

// Ruta fija: gana a `/api/[resource]`, asi "cv" nunca se toma por un recurso.
export const GET: APIRoute = (ctx) => getCv(ctx);
export const POST: APIRoute = (ctx) => uploadCv(ctx);
export const DELETE: APIRoute = (ctx) => deleteCv(ctx);
