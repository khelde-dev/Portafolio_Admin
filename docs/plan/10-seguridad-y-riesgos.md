# 10 · Seguridad y riesgos

Este panel puede **cambiar lo que el mundo ve en el portafolio** y manejar
**datos personales de terceros** (mensajes y comentarios). Es la pieza más sensible
del sistema, y su repositorio es público. El modelo de amenazas es corto porque el
usuario es uno solo, pero cada fila de la tabla cuenta.

## Superficie y mitigaciones

| # | Amenaza | Cómo se evita | Dónde se comprueba |
|---|---|---|---|
| 1 | Alguien llega al panel sin ser el dueño | Access (política con un solo correo) + verificación del JWT en el admin + `ADMIN_EMAILS` + el backend lo vuelve a verificar | pruebas de `access.ts`; lista de Access (cap. 04) |
| 2 | Access mal configurado o desactivado | el Worker responde 401/503 sin JWT válido; **nunca** sirve HTML ni datos "por si acaso" | prueba: sin JWT y sin `DEV` → 401 |
| 3 | Un hostname del Worker sin Access (`workers.dev`, ruta propia, vista previa) | `preview_urls: false`; al tener dominio, `workers_dev: false` y cada hostname dentro de la aplicación de Access | lista de comprobación de Access |
| 4 | Robo del token del backend | solo existe en secretos de Workers; escáner del bundle + gitleaks; no hay `console.log` de cabeceras; `fetch` en lugar de axios; el token solo se importa en `src/server/` | prueba de higiene; `check-bundle-secrets` |
| 5 | CSRF: una web ajena hace que tu navegador (con sesión de Access) llame al admin | rutas de escritura exigen mismo origen (`Origin`/`Sec-Fetch-Site`) y `application/json`; la cookie de Access no basta | pruebas de cada ruta `/api/*` |
| 6 | XSS que use tu sesión | sin `innerHTML`/`dangerouslySetInnerHTML`/`eval`; React escapa; el contenido de visitantes (comentarios, mensajes) se muestra como **texto**; CSP completo cuando se verifique en navegador | prueba de higiene; revisión |
| 7 | Contenido de un visitante con enlaces o HTML | se muestra como texto; los `mailto:`/`tel:` se arman con valores validados | pruebas de componentes |
| 8 | Una URL maliciosa (`javascript:`) guardada en un enlace | `httpUrl()` solo `http(s)` en el admin **y** en el backend | pruebas de esquema y contrato |
| 9 | Clave de imagen que escape del bucket o apunte a otro host | `r2Key()` (sin `..`, `:`, `\`, `//` inicial); la clave de una subida la genera el servidor | pruebas de esquema y de backend |
| 10 | Subida de un archivo que no es lo que dice ser | tipo exacto, cabecera `RIFF…WEBP` / `%PDF-`, tamaño y dimensiones tope, en el servidor | pruebas de integración del backend |
| 11 | Subir SVG/HTML como "imagen" y servirlo desde el dominio de medios | solo WebP y PDF; ningún otro tipo | ídem |
| 12 | Borrar por error una imagen en uso | el backend responde 409 si hay referencias; confirmación en la interfaz | prueba de `DELETE /media` |
| 13 | Pérdida de datos (borrado, edición errónea) | confirmación en borrados, exportaciones de D1 antes de cambios grandes, Time Travel, historial de actividad | procedimiento de respaldo (cap. 02) |
| 14 | Filtración de datos personales por logs o respaldos | los cuerpos de mensajes no se registran ni se auditan; `backups/` y `*.sql` en `.gitignore`; el repo es público, los datos no | revisión + gitleaks |
| 15 | Dependencias vulnerables | Dependabot, `pnpm audit` (estricto en `main`), dependency review, CodeQL | CI |
| 16 | Una subida enorme agota recursos | `Content-Length` rechazado antes de leer; tope de 2 MiB; tiempo máximo | pruebas de backend |
| 17 | El admin habla con un backend de versión incompatible | pantalla Estado + comprobación de versión | prueba y revisión de release |
| 18 | El cliente del backend lanza un error con datos sensibles | `BackendError` lleva **solo el estado HTTP**; las respuestas al navegador son genéricas | `backendClient.test.ts` |
| 19 | Secuestro de sesión | cookie `HttpOnly` de Access, sesión corta, revocación desde Zero Trust, rotación del token | procedimiento (cap. 04) |
| 20 | Clickjacking | `X-Frame-Options: DENY` y `frame-ancestors 'none'` | `securityHeaders.test.ts` |
| 21 | Indexación del panel en buscadores | `X-Robots-Tag: noindex`, `<meta robots>`, `robots.txt` que bloquea todo | e2e |

## Datos personales

- **Qué datos tiene el sistema de terceros:** nombre, correo y teléfono de quien
  escribe en el formulario; nombre y país de quien comenta. Son datos reales de
  personas.
- **Qué hace el admin con ellos:** los muestra solo al dueño, detrás de Access. No
  los copia, no los envía a ningún servicio y **no los escribe en el log de
  auditoría ni en `console`**.
- **Retención:** conservar lo necesario. Un mensaje respondido o spam se borra
  desde la bandeja; un comentario oculto puede conservarse. Nada se guarda en el
  navegador.
- **Exportación y borrado a petición:** si alguien lo pide, se hace con la
  bandeja (`DELETE /contact-messages/:id`) o, para comentarios, con el borrado de
  la fase 2. No requiere nada más.
- **Respaldos:** nunca al repositorio; los respaldos de D1 contienen estos datos.

## Principios de implementación

1. **Denegar por defecto.** Lista blanca de recursos y métodos; todo lo demás, 404/405.
2. **No confiar en nada del navegador:** ni el origen, ni el tipo, ni el tamaño, ni
   las claves de imagen, ni los ids.
3. **Mensajes de error genéricos** hacia fuera; el detalle útil (sin datos) solo a
   los logs.
4. **Menos es más:** cada dependencia nueva es superficie nueva; se prefiere
   `fetch`, `crypto` y las APIs del navegador a un paquete.
5. **Defensa en profundidad:** si una capa falla, la siguiente debe seguir
   protegiendo (Access → admin → backend).
6. **Cambios de seguridad con su prueba**: ninguna regla de este capítulo existe
   solo en un documento.

## Riesgos del proyecto (no de seguridad)

| Riesgo | Probabilidad | Impacto | Respuesta |
|---|---|---|---|
| Esquemas del admin y del backend se separan | media | medio | fixtures de contrato en ambos repos; prueba en CI |
| `translations` (mapa vs lista) mal convertido y se pierden traducciones | **alta si no se prueba** | alto | módulo único con pruebas de ida y vuelta; se construye primero |
| Safari no codifica WebP en canvas | baja (solo un usuario) | bajo | detección y mensaje claro; usar Chrome/Edge/Firefox |
| Se borra el CV de Vercel Blob antes de subirlo a R2 | media | medio | está en el roadmap (fase 6) y en este plan: bajar el PDF antes de borrar Vercel |
| Enlaces/WhatsApp quedan con copias distintas en el sitio | media | bajo | un solo origen (Ajustes) y una prueba de higiene en el portafolio que prohíbe URLs personales en el código |
| Alcance que crece (editor, analítica, correo) | alta | medio | los no-objetivos del cap. 01; cualquier adición se discute aquí antes |
