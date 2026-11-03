/**
 * Genera las llaves de PRUEBA para desarrollar el admin contra el backend local.
 *
 *   pnpm dev:access
 *
 * No escribe ningun archivo: imprime las lineas que hay que pegar en cada `.env`.
 * La llave privada solo sale en tu terminal; el repositorio nunca la ve.
 * Estas llaves son de usar y tirar y no tienen nada que ver con Cloudflare Access.
 */
import { generateKeyPairSync } from "node:crypto";
import { fileURLToPath } from "node:url";

// Mismos valores que src/server/devAccess.ts (una prueba comprueba que coincidan).
export const DEV_AUD = "dev-local-aud";
export const DEV_TEAM = "https://dev-local.cloudflareaccess.com";
export const DEV_KID = "dev-local-key";

/** Devuelve el par en JWK y las dos lineas de configuracion. */
export const buildDevKit = () => {
	const { publicKey, privateKey } = generateKeyPairSync("rsa", {
		modulusLength: 2048,
	});
	const privateJwk = {
		...privateKey.export({ format: "jwk" }),
		kid: DEV_KID,
		alg: "RS256",
	};
	const publicJwk = {
		...publicKey.export({ format: "jwk" }),
		kid: DEV_KID,
		alg: "RS256",
		use: "sig",
	};
	return {
		privateJwk,
		publicJwk,
		adminLines: [`DEV_ACCESS_KEY='${JSON.stringify(privateJwk)}'`],
		backendLines: [
			`ACCESS_AUD=${DEV_AUD}`,
			`ACCESS_TEAM_DOMAIN=${DEV_TEAM}`,
			`ACCESS_JWKS='${JSON.stringify({ keys: [publicJwk] })}'`,
		],
	};
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	const kit = buildDevKit();
	console.log(`
Llaves de prueba generadas. Pega cada bloque donde corresponde y reinicia
los dos servidores (el del admin y "wrangler dev" del backend).

1) En el .env de Portafolio_admin  (agrega esta linea; es PRIVADA, no la compartas):

${kit.adminLines.join("\n")}

2) En el archivo de variables del BACKEND local (agrega estas lineas):
   Si ahi usas ".env", van en ".env". No crees un ".dev.vars" nuevo si ya tienes
   ".env": wrangler lee uno u otro y perderias el API_TOKEN.

${kit.backendLines.join("\n")}

3) Comprueba que API_SECRET_TOKEN del admin y API_TOKEN del backend sean el mismo valor.
`);
}
