import type { ImageUsage } from "@/lib/apiClient";

/** Un objeto de la biblioteca (`GET /api/media`). */
export interface MediaObject {
	key: string;
	size: number;
	uploaded: string;
	usedBy: ImageUsage[];
}

export interface MediaListing {
	objects: MediaObject[];
	truncated: boolean;
}

/** Pantalla donde se edita el elemento que usa una imagen. */
export const usageHref = (usage: ImageUsage): string | null => {
	switch (usage.resource) {
		case "projects":
			return `/proyectos/${usage.id}`;
		case "experiences":
			return `/experiencia/${usage.id}`;
		case "education":
			return `/educacion/${usage.id}`;
		case "about":
			return "/sobre-mi";
		case "site-copy":
			return "/textos";
		default:
			return null;
	}
};

export const FIELD_LABELS: Record<string, string> = {
	card_image: "tarjeta",
	gallery: "galería",
	img: "logo",
	image: "imagen",
	hero_image: "foto del hero",
};

/** `projects/6f1c…e2.webp` -> `…e2.webp` para que quepa en una tarjeta. */
export const shortKey = (key: string, max = 28): string =>
	key.length <= max ? key : `…${key.slice(-(max - 1))}`;

/** Codifica cada segmento de una clave para ponerla en una URL (`a/b c.webp` -> `a/b%20c.webp`). */
export const keyToPath = (key: string): string =>
	key.split("/").map(encodeURIComponent).join("/");
