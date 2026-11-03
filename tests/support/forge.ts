/**
 * JWT de Cloudflare Access FALSOS para las pruebas: un par RSA generado en el
 * propio test, nunca un token ni una llave reales.
 */
const b64url = (data: ArrayBuffer | Uint8Array | string): string => {
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

export const TEAM = "https://equipo-de-prueba.cloudflareaccess.com";
export const AUD = "a".repeat(64);

export interface Forge {
	kid: string;
	publicJwk: JsonWebKey & { kid: string };
	sign: (
		claims: Record<string, unknown>,
		header?: Record<string, unknown>,
	) => Promise<string>;
}

export const makeForge = async (kid = "llave-1"): Promise<Forge> => {
	const pair = (await crypto.subtle.generateKey(
		{
			name: "RSASSA-PKCS1-v1_5",
			modulusLength: 2048,
			publicExponent: new Uint8Array([1, 0, 1]),
			hash: "SHA-256",
		},
		true,
		["sign", "verify"],
	)) as CryptoKeyPair;
	const jwk = (await crypto.subtle.exportKey(
		"jwk",
		pair.publicKey,
	)) as JsonWebKey;
	const publicJwk = { ...jwk, kid, alg: "RS256", use: "sig" } as JsonWebKey & {
		kid: string;
	};

	return {
		kid,
		publicJwk,
		sign: async (claims, header = {}) => {
			const head = b64url(
				JSON.stringify({ alg: "RS256", kid, typ: "JWT", ...header }),
			);
			const body = b64url(JSON.stringify(claims));
			const signature = await crypto.subtle.sign(
				"RSASSA-PKCS1-v1_5",
				pair.privateKey,
				new TextEncoder().encode(`${head}.${body}`),
			);
			return `${head}.${body}.${b64url(signature)}`;
		},
	};
};

/** Claims validos de Access, con los campos que se quieran cambiar. */
export const claims = (over: Record<string, unknown> = {}) => ({
	aud: [AUD],
	iss: TEAM,
	email: "yo@ejemplo.dev",
	iat: Math.floor(Date.now() / 1000),
	exp: Math.floor(Date.now() / 1000) + 3600,
	...over,
});

/** Simula `GET <equipo>/cdn-cgi/access/certs` con las llaves dadas. */
export const stubCerts = (
	vi: {
		fn: () => { mockResolvedValue: (v: unknown) => unknown };
		stubGlobal: (n: string, v: unknown) => void;
	},
	keys: unknown[],
) => {
	const fetchMock = vi.fn();
	fetchMock.mockResolvedValue(Response.json({ keys }));
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock as unknown as import("vitest").Mock;
};
