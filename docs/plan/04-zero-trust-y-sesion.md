# 04 · Zero Trust, sesión y cierre de sesión

El admin **no tiene login propio**. Cloudflare Access (Zero Trust) se coloca
delante del Worker, autentica a la persona y le entrega al Worker un JWT firmado.
El admin y el backend solo verifican ese JWT.

## Cómo encaja cada pieza

```
          ┌──────────────────────── Cloudflare ────────────────────────┐
 tú ────► │ Access (aplicación "portafolio-admin")                      │
          │   política: permitir solo tu correo                         │
          │   método: código de un solo uso (OTP) por correo            │
          │   sesión: N horas  →  cookie CF_Authorization + JWT         │
          └───────────────┬─────────────────────────────────────────────┘
                          ▼  cabecera Cf-Access-Jwt-Assertion
               Worker portafolio-admin  ──(mismo JWT)──►  Worker backend-portafolio
               verifica firma, aud, iss, exp               verifica firma, aud, iss, exp
```

Ambos Workers verifican **lo mismo**: el JWT lo emitió Access para la aplicación
del **admin**, así que el `aud` de ese token es el AUD de esa aplicación. Por eso:

| Variable | En el admin | En el backend |
|---|---|---|
| `ACCESS_AUD` | AUD de la app de Access del admin | **el mismo valor** |
| `ACCESS_TEAM_DOMAIN` | `https://<equipo>.cloudflareaccess.com` | **el mismo valor** |

> El valor del dominio del equipo **incluye `https://`**: el backend lo usa como
> `iss` esperado y para armar `…/cdn-cgi/access/certs` (las llaves públicas).
> Poner solo `<equipo>.cloudflareaccess.com` hace que toda petición responda 401.

**El Worker del backend no se protege con Access**: bloquearía al portafolio
público, que lo consume sin sesión. Su protección es el bearer, el rate limit y
que las rutas del CMS exigen el JWT.

## Puesta en marcha (orden obligatorio)

1. Desplegar el Worker del admin y comprobar que responde en
   `portafolio-admin.<cuenta>.workers.dev`. Hasta aquí **no hay datos**: el
   esqueleto no llama al backend.
2. **Crear la aplicación de Access** (Zero Trust → Access → Applications →
   Self-hosted) para ese hostname. En la pestaña del Worker hay un atajo
   (Settings → Domains & Routes → Cloudflare Access) que la crea sola
   **[verificar]**.
3. Política única: acción **Allow**, regla **Include → Emails → tu correo**.
   Nada de "Everyone" ni dominios completos. Nada más.
4. Método de acceso: **One-time PIN** (no requiere proveedor de identidad). Se puede
   añadir Google después; no hace falta.
5. Duración de sesión: **8–12 h** (un día de trabajo). Más largo = más tiempo
   útil para un token robado; más corto = login constante.
6. Copiar el **AUD** (pestaña Overview de la aplicación) y el **dominio del equipo**.
7. Cargarlos como variables en el admin (`ACCESS_AUD`, `ACCESS_TEAM_DOMAIN`, en
   `wrangler.jsonc` o en el panel) **y** en el backend (`wrangler.jsonc` →
   `vars`), y cargar `API_SECRET_TOKEN` como secreto en el admin.
8. Probar en una ventana privada: pide el código, entra, el admin muestra tu
   correo. Probar sin sesión: debe redirigir al login de Access.
9. **Solo ahora** ya se pueden mostrar datos reales (fase 2 en adelante).

> Hasta que el paso 7 esté hecho, las rutas del CMS del backend responden **503**
> ("Cloudflare Access no esta configurado"). Es el comportamiento seguro a
> propósito: sin configuración, nadie escribe.

## Verificación del JWT en el admin

`src/server/access.ts` (fase 1). Mismas reglas que `accessAuth` del backend, en el
middleware del admin, para todo menos los activos estáticos:

1. Leer `Cf-Access-Jwt-Assertion`. Sin él → **401** (en producción).
2. `verifyWithJwks` de Hono: llaves de `${ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`,
   solo `RS256`, `aud = ACCESS_AUD`, `iss = ACCESS_TEAM_DOMAIN`.
3. Exigir `exp` numérico (un token sin expiración nunca caduca).
4. Si `ACCESS_AUD` o `ACCESS_TEAM_DOMAIN` están vacíos → **503**, nunca "dejar
   pasar".
5. **Lista de correos permitidos** (`ADMIN_EMAILS`): el `email` del JWT debe estar
   en la lista. Es defensa en profundidad: si alguien relaja la política de Access
   por error (p. ej. permite todo un dominio), el admin sigue cerrado.
6. Dejar `locals.user = { email }` para páginas y rutas; **nunca** guardar el JWT
   en `localStorage`, en el HTML ni en una variable del navegador.
7. Las llaves públicas se piden con caché de Cloudflare (`cacheTtl: 3600`), como en
   el backend, para no pegarle a Access en cada petición.

Respuestas: HTML de error mínimo y genérico para navegación, JSON `{ message }`
para `/api/*`. Nunca detalles del motivo del rechazo.

### Desarrollo local

No hay Access en `pnpm dev`. El middleware inyecta un usuario falso
(`dev@localhost`) **solo** cuando `import.meta.env.DEV` es verdadero. Ese código
queda eliminado del build de producción (la condición es una constante en tiempo
de compilación) y una prueba comprueba que **sin `DEV` y sin JWT la respuesta es
401**. Para probar contra un backend real en local hace falta un JWT firmado:
el backend admite `ACCESS_JWKS` (llaves fijas) justo para pruebas y local; el
admin reutiliza ese mecanismo con un par de llaves de prueba que nunca se usa en
producción.

## Cierre de sesión (logout)

Con Access, **cerrar sesión no es borrar una cookie propia**: es pedirle a Access
que invalide la sesión de esa aplicación.

- Botón **"Cerrar sesión"** en el menú de la cuenta (esquina del menú lateral).
  Es un enlace real (`<a>`), no una acción de JavaScript:
  `/cdn-cgi/access/logout`, en el mismo hostname del admin. Cloudflare borra la
  cookie `CF_Authorization` de esa aplicación y muestra su pantalla de cierre.
  Un parámetro `returnTo` para volver a una página concreta existe en el cierre
  del equipo **[verificar]**; si no sirve, se acepta la pantalla de Access.
- Antes de salir, la isla limpia lo que tenga en memoria (listas, borradores).
  El admin no guarda datos sensibles en el navegador: solo la preferencia de
  tema.
- **El JWT es sin estado:** cerrar sesión borra la cookie, pero un token ya
  emitido sigue siendo válido hasta su `exp`. Por eso la sesión es corta y por eso
  existe, en Zero Trust → Users, la opción de **revocar sesiones** de una persona
  **[verificar]**. Si se sospecha de robo: revocar la sesión y rotar `API_SECRET_TOKEN`.
- Tras cerrar sesión, cualquier URL del admin vuelve a pedir el código por correo.
- Pantalla **Cuenta** muestra el correo (del JWT, renderizado en el servidor), la
  hora de expiración de la sesión (`exp`) y el botón de salir.
- **Cierre por inactividad:** innecesario. Access ya vence la sesión; añadir un
  temporizador propio no agrega seguridad real y sí fallos al editar un
  formulario largo.

## Cuando haya dominio propio (`khelde.dev`)

- Agregar `admin.khelde.dev` como **hostname adicional de la misma aplicación** de
  Access: el **AUD no cambia**, así que no se toca el backend.
- Poner `"workers_dev": false` en el admin para que solo exista el hostname
  protegido. Si el Worker tuviera además una ruta propia sin Access, esa ruta
  quedaría abierta: **cada hostname del Worker debe estar en la aplicación**.
- `preview_urls` ya está en `false`: no hay URLs de vista previa sin proteger.
- Actualizar `PUBLIC_MEDIA_URL` y `PUBLIC_PORTFOLIO_URL` (variables de build) y
  `BACKEND_URL` si el API cambia de hostname.

## Qué ve alguien sin sesión

- Cualquier ruta del admin → redirige a la pantalla de login de Access (ni
  siquiera llega al Worker).
- Si llegara al Worker sin JWT (Access mal configurado) → 401 genérico; el HTML del
  admin **no se sirve**.
- `robots.txt` bloquea todo y cada respuesta lleva `X-Robots-Tag: noindex`: el
  panel no aparece en buscadores aunque alguien conociera la URL.

## Lista de comprobación de Access

- [ ] Una sola aplicación, un solo hostname por ahora, política Allow con un solo correo.
- [ ] Método OTP; sesión de 8–12 h.
- [ ] `ACCESS_AUD` y `ACCESS_TEAM_DOMAIN` idénticos en admin y backend (con `https://`).
- [ ] `ADMIN_EMAILS` definido en admin (y backend, opcional).
- [ ] Sin sesión: redirige al login. Con otro correo: rechazado.
- [ ] `curl` sin cabecera al admin y a las rutas del CMS del backend: 401 (no 200).
- [ ] La URL de `workers.dev` del **backend** sigue respondiendo al portafolio (sin Access).
