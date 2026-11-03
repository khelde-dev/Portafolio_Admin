import type { APIRoute } from "astro";
import { deleteMedia } from "@/server/mediaProxy";

export const DELETE: APIRoute = (ctx) => deleteMedia(ctx);
