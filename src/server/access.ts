/**
 * Verificacion del JWT de Cloudflare Access (cabecera `Cf-Access-Jwt-Assertion`).
 *
 * Mismas reglas que `accessAuth` del Backend_Portafolio: firma RS256 contra las
 * llaves publicas del equipo, `aud` = AUD de la aplicacion, `iss` = dominio del
 * equipo y `exp` obligatorio. Se hace con WebCrypto (sin dependencias) y SOLO
 * corre en el servidor.
 *
 * No hay estado: cada peticion se verifica sola. Un token robado sirve hasta su
 * `exp` (la sesion de Access es de 24 h); por eso el admin tambien exige que el
 * correo este en `ADMIN_EMAILS` cuando esa lista existe.
 */
export const ACCESS_HEADER = "Cf-Access-Jwt-Assertion";

export interface AccessUser {
	email: string;
	/** Segundos desde epoch en que vence la sesion. */
	exp: number;
}

export interface AccessConfig {
	/** `https://<equipo>.cloudflareaccess.com` */
	team: string;
	aud: string;
	/** Correos permitidos; vacio = solo manda la politica de Access. */
	allowedEmails?: string[];
}

export type AccessResult =
	| { ok: true; user: AccessUser }
	| { ok: false; status: 401 | 403 | 503; reason: string };

interface Jwk {
	kid?: string;
	kty: string;
	alg?: string;
	n?: string;
	e?: string;
}

const KEY_TTL_MS = 60 * 60 * 1000;
const keyCache = new Map<string, { at: number; keys: Jwk[] }>();

const trimSlash = (url: string) => url.replace(/\/+$/, "");

/**
 * `https://equipo.cloudflareaccess.com` (con o sin barra final) o solo
 * `equipo.cloudflareaccess.com`: se normaliza a la forma con https://, que es
 * la del `iss` del JWT. Asi un valor sin esquema no rompe el login.
 */
export const normalizeTeam = (team: string): string => {
	const trimmed = trimSlash(team.trim());
	return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
};

const b64urlToBytes = (value: string): Uint8Array<ArrayBuffer> => {
	const padded = value
		.replaceAll("-", "+")
		.replaceAll("_", "/")
		.padEnd(Math.ceil(value.length / 4) * 4, "=");
	const raw = atob(padded);
	const bytes = new Uint8Array(raw.length);
	for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
	return bytes;
};

const decodeJson = <T>(part: string): T =>
	JSON.parse(new TextDecoder().decode(b64urlToBytes(part))) as T;

/** Llaves publicas del equipo, con cache en memoria y en el borde de Cloudflare. */
const loadKeys = async (team: string, force = false): Promise<Jwk[]> => {
	const cached = keyCache.get(team);
	if (!force && cached && Date.now() - cached.at < KEY_TTL_MS) {
		return cached.keys;
	}
	const response = await fetch(`${team}/cdn-cgi/access/certs`, {
		cf: { cacheTtl: 3600, cacheEverything: true },
		signal: AbortSignal.timeout(5000),
	} as RequestInit);
	if (!response.ok) throw new Error("No se pudieron leer las llaves de Access");
	const { keys } = (await response.json()) as { keys?: Jwk[] };
	if (!Array.isArray(keys)) throw new Error("Respuesta de llaves no valida");
	keyCache.set(team, { at: Date.now(), keys });
	return keys;
};

/** Solo para pruebas: olvida las llaves guardadas. */
export const clearAccessKeyCache = () => keyCache.clear();

const verifySignature = async (
	jwk: Jwk,
	signed: string,
	signature: Uint8Array<ArrayBuffer>,
): Promise<boolean> => {
	const key = await crypto.subtle.importKey(
		"jwk",
		{ kty: jwk.kty, n: jwk.n, e: jwk.e, alg: "RS256", ext: true },
		{ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
		false,
		["verify"],
	);
	return crypto.subtle.verify(
		"RSASSA-PKCS1-v1_5",
		key,
		signature,
		new TextEncoder().encode(signed),
	);
};

interface Claims {
	aud?: string | string[];
	iss?: string;
	exp?: number;
	nbf?: number;
	email?: string;
	common_name?: string;
}

/**
 * Devuelve el usuario si el JWT es valido; si no, lanza. Nunca devuelve el
 * motivo detallado al navegador: `authenticate` lo reduce a un 401.
 */
export const verifyAccessJwt = async (
	token: string,
	{ team, aud }: Pick<AccessConfig, "team" | "aud">,
	now = Math.floor(Date.now() / 1000),
): Promise<AccessUser> => {
	const parts = token.split(".");
	if (parts.length !== 3) throw new Error("JWT mal formado");
	const [h, p, s] = parts;

	const header = decodeJson<{ alg?: string; kid?: string }>(h);
	if (header.alg !== "RS256") throw new Error("Algoritmo no permitido");

	const issuer = normalizeTeam(team);
	const signed = `${h}.${p}`;
	const signature = b64urlToBytes(s);

	let keys = await loadKeys(issuer);
	let jwk = keys.find((k) => k.kid === header.kid);
	if (!jwk) {
		// Access rota llaves: una sola recarga antes de rechazar.
		keys = await loadKeys(issuer, true);
		jwk = keys.find((k) => k.kid === header.kid);
	}
	if (!jwk) throw new Error("Llave desconocida");
	if (!(await verifySignature(jwk, signed, signature))) {
		throw new Error("Firma invalida");
	}

	const claims = decodeJson<Claims>(p);
	// Access siempre firma con expiracion: sin `exp` un token nunca caducaria.
	if (typeof claims.exp !== "number") throw new Error("Token sin exp");
	if (claims.exp <= now) throw new Error("Token vencido");
	if (typeof claims.nbf === "number" && claims.nbf > now + 60) {
		throw new Error("Token aun no valido");
	}
	if (trimSlash(claims.iss ?? "") !== issuer)
		throw new Error("Emisor invalido");
	const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
	if (!audiences.includes(aud)) throw new Error("Audiencia invalida");

	const email = claims.email ?? claims.common_name;
	if (typeof email !== "string" || email === "") throw new Error("Sin correo");
	return { email, exp: claims.exp };
};

/** `a@x.com, B@y.com` -> ["a@x.com", "b@y.com"] */
export const parseAllowedEmails = (raw: string | undefined): string[] =>
	(raw ?? "")
		.split(",")
		.map((email) => email.trim().toLowerCase())
		.filter(Boolean);

/**
 * Decision final para una peticion. Falla CERRADO: sin configuracion o sin JWT
 * valido nunca se sirve nada (503/401); el unico atajo es el usuario falso de
 * desarrollo, que solo existe cuando `dev` es verdadero (`import.meta.env.DEV`).
 */
export const authenticate = async (
	headers: Headers,
	config: Partial<AccessConfig>,
	options: { dev?: boolean; now?: number } = {},
): Promise<AccessResult> => {
	const { team, aud, allowedEmails = [] } = config;

	// Solo en `pnpm dev`: `import.meta.env.DEV` es la constante `false` en el
	// build, asi que este atajo no puede activarse en produccion.
	if (options.dev) {
		return {
			ok: true,
			user: {
				email: "dev@localhost",
				exp: Math.floor(Date.now() / 1000) + 3600,
			},
		};
	}

	if (!team || !aud) {
		return { ok: false, status: 503, reason: "Access sin configurar" };
	}

	const token = headers.get(ACCESS_HEADER);
	if (!token) return { ok: false, status: 401, reason: "Sin sesion de Access" };

	let user: AccessUser;
	try {
		user = await verifyAccessJwt(token, { team, aud }, options.now);
	} catch {
		return { ok: false, status: 401, reason: "Sesion de Access invalida" };
	}

	if (
		allowedEmails.length > 0 &&
		!allowedEmails.includes(user.email.toLowerCase())
	) {
		return { ok: false, status: 403, reason: "Correo no permitido" };
	}
	return { ok: true, user };
};
