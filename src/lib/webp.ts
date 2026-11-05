/**
 * Convierte una imagen a WebP EN EL NAVEGADOR antes de subirla (los Workers no
 * pueden usar `sharp`). Redimensiona, baja la calidad hasta que cabe en el tope
 * de su uso y, de paso, borra los metadatos (EXIF, ubicacion GPS) porque la
 * imagen se vuelve a codificar desde los pixeles.
 *
 * Todo lo del navegador entra por `BrowserApi`, asi la logica se prueba sin un
 * navegador real. Reglas de docs/plan/05-imagenes-r2.md.
 */

/** Para que sirve la imagen: define carpeta, lado maximo y peso objetivo. */
export const UPLOAD_USES = {
	card: {
		folder: "projects",
		label: "Tarjeta de proyecto",
		maxSide: 1600,
		maxBytes: 500 * 1024,
	},
	gallery: {
		folder: "projects",
		label: "Galería de proyecto",
		maxSide: 1920,
		maxBytes: 700 * 1024,
	},
	logo: {
		folder: "experience",
		label: "Logo de experiencia",
		maxSide: 512,
		maxBytes: 120 * 1024,
	},
	school: {
		folder: "education",
		label: "Logo de educación",
		maxSide: 512,
		maxBytes: 120 * 1024,
	},
	about: {
		folder: "about",
		label: "Retrato de Sobre mí",
		maxSide: 1200,
		maxBytes: 400 * 1024,
	},
	site: {
		folder: "site",
		label: "Foto del hero",
		maxSide: 1600,
		maxBytes: 400 * 1024,
	},
} as const;
export type UploadUse = keyof typeof UPLOAD_USES;

/** Tipos que se aceptan de entrada. SVG (puede llevar scripts) y GIF animado, no. */
export const ACCEPTED_TYPES = [
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/avif",
] as const;
export const ACCEPT_ATTRIBUTE = ACCEPTED_TYPES.join(",");

/** Tope del archivo original antes de convertir (evita decodificar gigantes). */
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;

const QUALITIES = [0.82, 0.72, 0.62, 0.5] as const;

export class ImageError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "ImageError";
	}
}

export interface DecodedImage {
	width: number;
	height: number;
	close?: () => void;
}

export interface BrowserApi {
	/** Decodifica respetando la rotacion EXIF. */
	decode: (file: Blob) => Promise<DecodedImage>;
	/** Dibuja la imagen a `width x height` y la codifica. `type` puede salir distinto si no hay codificador. */
	encode: (
		image: DecodedImage,
		width: number,
		height: number,
		quality: number,
	) => Promise<Blob | null>;
}

export interface WebpResult {
	blob: Blob;
	width: number;
	height: number;
	originalBytes: number;
	quality: number;
}

/** Reduce a `maxSide` el lado mas largo sin deformar y sin agrandar nunca. */
export const fitWithin = (width: number, height: number, maxSide: number) => {
	const longest = Math.max(width, height);
	if (longest <= maxSide) return { width, height };
	const scale = maxSide / longest;
	return {
		width: Math.max(1, Math.round(width * scale)),
		height: Math.max(1, Math.round(height * scale)),
	};
};

export const formatBytes = (bytes: number): string =>
	bytes < 1024 * 1024
		? `${Math.round(bytes / 1024)} KB`
		: `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

export const convertToWebp = async (
	file: Blob & { name?: string },
	use: UploadUse,
	api: BrowserApi = browserApi,
): Promise<WebpResult> => {
	const spec = UPLOAD_USES[use];

	if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) {
		throw new ImageError(
			file.type === "image/svg+xml"
				? "Los SVG no se aceptan (pueden llevar código). Usa PNG, JPG, WebP o AVIF."
				: file.type === "image/gif"
					? "Los GIF no se aceptan (se perdería la animación). Usa PNG, JPG, WebP o AVIF."
					: "Formato no admitido. Usa PNG, JPG, WebP o AVIF.",
		);
	}
	if (file.size > MAX_SOURCE_BYTES) {
		throw new ImageError(
			`El archivo pesa ${formatBytes(file.size)}; el máximo es ${formatBytes(MAX_SOURCE_BYTES)}.`,
		);
	}

	let image: DecodedImage;
	try {
		image = await api.decode(file);
	} catch {
		throw new ImageError("No se pudo leer la imagen. Puede estar dañada.");
	}

	try {
		const { width, height } = fitWithin(
			image.width,
			image.height,
			spec.maxSide,
		);
		let smallest: { blob: Blob; quality: number } | null = null;

		for (const quality of QUALITIES) {
			const blob = await api.encode(image, width, height, quality);
			// Safari devuelve PNG cuando no sabe codificar WebP: nunca se sube eso.
			if (!blob || blob.type !== "image/webp") {
				throw new ImageError(
					"Este navegador no puede crear WebP. Usa Chrome, Edge o Firefox para subir imágenes.",
				);
			}
			if (!smallest || blob.size < smallest.blob.size)
				smallest = { blob, quality };
			if (blob.size <= spec.maxBytes)
				return { blob, width, height, originalBytes: file.size, quality };
		}

		throw new ImageError(
			`Aun con la calidad más baja pesa ${formatBytes(smallest?.blob.size ?? 0)} y el tope es ${formatBytes(spec.maxBytes)}. Prueba con una imagen más pequeña.`,
		);
	} finally {
		image.close?.();
	}
};

/** Implementacion real con las APIs del navegador (canvas WebP). */
export const browserApi: BrowserApi = {
	decode: (file) => createImageBitmap(file, { imageOrientation: "from-image" }),
	encode: async (image, width, height, quality) => {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const context = canvas.getContext("2d");
		if (!context) return null;
		context.drawImage(image as ImageBitmap, 0, 0, width, height);
		return new Promise<Blob | null>((resolve) =>
			canvas.toBlob(resolve, "image/webp", quality),
		);
	},
};
