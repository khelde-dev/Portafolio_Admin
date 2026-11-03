/**
 * JWT de Access de PRUEBA para el desarrollo local. En `pnpm dev` no hay
 * Cloudflare Access, asi que el backend local (que si exige el JWT en las rutas
 * del CMS) respondia 503 y ninguna pantalla cargaba datos.
 *
 * Con `pnpm dev:access` se genera un par de llaves de prueba: la PRIVADA va al
 * `.env` del admin (`DEV_ACCESS_KEY`) y la PUBLICA al del backend
 * (`ACCESS_JWKS`, que el backend ya admite justo para esto). El admin firma con
 * la privada un JWT de 1 hora y lo manda como si viniera de Access.
 *
 * Solo corre con `import.meta.env.DEV` (en el build es `false`) y la llave es de
 * usar y tirar: nunca la de produccion, que es de Cloudflare.
 */
export const DEV_AUD = "dev-local-aud";
export const DEV_TEAM = "https://dev-local.cloudflareaccess.com";
export const DEV_KID = "dev-local-key";
export const DEV_EMAIL = "dev@localhost";

const b64url = (data: ArrayBuffer | string): string => {
	const bytes =
		typeof data === "string"
			? new TextEncoder().encode(data)
			: new Uint8Array(data);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary)
		.replaceAll("+", "-")
		.replaceAll("/", "_")
		.replace(/=+$/, "");
};

/** Firma un JWT con el formato de Access usando una llave privada JWK de prueba. */
export const signDevJwt = async (
	privateJwk: JsonWebKey,
	now = Math.floor(Date.now() / 1000),
): Promise<string> => {
	const key = await crypto.subtle.importKey(
		"jwk",
		privateJwk,
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["sign"],
	);
	const header = b64url(
		JSON.stringify({ alg: "RS256", typ: "JWT", kid: DEV_KID }),
	);
	const payload = b64url(
		JSON.stringify({
			aud: [DEV_AUD],
			iss: DEV_TEAM,
			email: DEV_EMAIL,
			iat: now,
			exp: now + 3600,
		}),
	);
	const signature = await crypto.subtle.sign(
		"RSASSA-PKCS1-v1_5",
		key,
		new TextEncoder().encode(`${header}.${payload}`),
	);
	return `${header}.${payload}.${b64url(signature)}`;
};

let cached: { jwt: string; exp: number } | null = null;

/**
 * El JWT de prueba, o `null` si no hay llave configurada (entonces el backend
 * local respondera 401/503 y la pantalla Estado lo dira). Se reutiliza hasta
 * poco antes de vencer.
 */
export const devJwt = async (): Promise<string | null> => {
	const now = Math.floor(Date.now() / 1000);
	if (cached && cached.exp - 60 > now) return cached.jwt;
	try {
		const { DEV_ACCESS_KEY } = await import("astro:env/server");
		if (!DEV_ACCESS_KEY) return null;
		const jwt = await signDevJwt(JSON.parse(DEV_ACCESS_KEY) as JsonWebKey, now);
		cached = { jwt, exp: now + 3600 };
		return jwt;
	} catch {
		// Sin llave, con una llave mal pegada o fuera de dev: sin JWT de prueba.
		return null;
	}
};

/** Solo para pruebas. */
export const resetDevJwt = () => {
	cached = null;
};
