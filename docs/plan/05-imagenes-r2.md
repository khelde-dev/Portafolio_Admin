# 05 · Imágenes y R2

**Regla central: toda imagen se guarda en WebP.** No hay una opción para subir
PNG, JPG o SVG a R2; la interfaz convierte antes de subir y el backend rechaza lo
que no sea WebP.

## Estado de partida

- Bucket R2 `portfolio` (binding `MEDIA` en el backend), público por la URL
  `r2.dev` (`PUBLIC_MEDIA_URL`).
- Las filas guardan **claves**, no URLs: `Backend_Task.webp`, `/UPVM.webp`,
  `projects/abc.webp`. El sitio las une con `mediaUrl()`, que quita barras
  repetidas y no permite que una clave apunte a otro host.
- **El backend no tiene ninguna ruta para subir o borrar** (el comentario en
  `index.ts` habla de "una ruta propia con su límite", pero no existe). Hoy las
  imágenes se suben a mano al panel de Cloudflare ya convertidas.
- `r2Key()` (validador del backend) acepta claves sin `..`, sin `:`, sin `\`, sin
  `//` inicial, sin caracteres de control y de hasta 512 caracteres. Las claves
  nuevas serán más estrictas que ese mínimo.

## Dónde se convierte a WebP

Los Workers **no pueden usar `sharp`** (módulo nativo). Las opciones:

| Opción | Costo/complejidad | Veredicto |
|---|---|---|
| **Convertir en el navegador** (canvas) antes de subir | cero servicios, cero dependencias del servidor | **elegida** |
| Wasm en el Worker (`@jsquash/webp`, `photon`) | +CPU en cada subida, +tamaño del Worker, límite de CPU en el plan gratis | descartada por ahora |
| Cloudflare Images / transformaciones al servir | servicio aparte, cuota gratuita limitada, otra superficie | descartada: no convierte lo que ya está en R2 como archivo fuente |

Como el único usuario es el dueño y usa un navegador de escritorio moderno, la
conversión en el cliente es la opción más simple y no depende de nadie. Ventajas
colaterales: el re-codificado **elimina los metadatos EXIF** (ubicación GPS, modelo
de cámara) y el servidor recibe siempre un archivo ya pequeño.

### Flujo en el navegador

1. El usuario elige un archivo (o lo arrastra). Se aceptan PNG, JPEG, WebP y AVIF
   (lo que el navegador sepa decodificar). **No se aceptan SVG** (pueden llevar
   scripts) **ni GIF animados** (se perdería la animación sin avisar).
2. Decodificar con `createImageBitmap(file, { imageOrientation: "from-image" })`
   para respetar la rotación EXIF.
3. **Redimensionar** si excede el máximo de su uso (tabla más abajo). Nunca se
   agranda.
4. Dibujar en un canvas y exportar con `canvas.toBlob(cb, "image/webp", calidad)`.
5. **Comprobar que de verdad salió WebP** (`blob.type === "image/webp"`). Safari
   devuelve PNG cuando no sabe codificar WebP: en ese caso se bloquea la subida
   con un mensaje claro ("Este navegador no puede crear WebP; usa Chrome, Edge o
   Firefox"), nunca se sube otro formato.
6. Calidad inicial 0.82; si el archivo pasa del tope de su uso, bajar a 0.72 y 0.62.
   Si aun así no cabe, error con el tamaño obtenido y el tope.
7. Mostrar **vista previa** y el antes/después ("2.4 MB → 180 KB, 1600 × 900").
8. Al confirmar, subir.

### Tamaños máximos por uso

| Uso | Campo | Máx. lado largo | Tope de archivo |
|---|---|---|---|
| Tarjeta de proyecto | `projects.card_image` | 1280 px | 400 KB |
| Galería de proyecto | `projects.gallery[]` | 1920 px | 700 KB |
| Logo de experiencia | `experience.img` | 512 px | 120 KB |
| Logo de educación | `education.image` | 512 px | 120 KB |
| Retrato de Sobre mí | `about.image` | 1200 px | 400 KB |
| Vista previa social | `site_settings.og_image_key` | 1200 × 630 exactos | 300 KB |

Los topes son del **cliente** (para convertir bien). El servidor impone un tope
duro único: **2 MiB** y **4096 px** por lado.

## Subida: de la isla al bucket

```
isla (blob WebP) ──POST /api/media?use=card──► admin /api/media ──POST /api/media──► backend ──► R2.put
        Content-Type: image/webp                 verifica JWT, tipo,       bearer + JWT        genera la clave
                                                 tamaño; reenvía el        valida otra vez     guarda con cabeceras
                                                 cuerpo en streaming       cabecera RIFF/WEBP  de caché
```

- **Cuerpo binario** con `Content-Type: image/webp`, **no `multipart/form-data`**: el
  CSRF de Hono bloquea los formularios cuando no hay un origen permitido, y un
  cuerpo binario es más sencillo de validar y de pasar en streaming.
- El admin **no abre el archivo**: lo reenvía (con el tope de tamaño aplicado
  mientras lo lee) para no gastar CPU ni memoria del Worker.
- **El servidor decide la clave.** El cliente manda solo el uso (`card`, `gallery`,
  `logo`, `about`, `og`). La clave es `<area>/<uuid>.webp` con
  `crypto.randomUUID()`, p. ej. `projects/6f1c…e2.webp`. Nunca el nombre del
  archivo del usuario (caracteres raros, colisiones, fugas de información).
- **Validación en el backend**, en este orden:
  1. Access + bearer + `Content-Length` ≤ 2 MiB (rechazar antes de leer).
  2. `Content-Type` exactamente `image/webp`.
  3. Los primeros bytes: `RIFF` (0–3), `WEBP` (8–11). Sin esto se rechaza aunque
     la cabecera mienta.
  4. Dimensiones leídas del encabezado (`VP8 `, `VP8L` o `VP8X`) ≤ 4096 px.
  5. Cuerpo realmente leído ≤ 2 MiB (no confiar solo en `Content-Length`).
- **`R2.put(key, body, { httpMetadata, customMetadata })`** con
  `contentType: "image/webp"`, `cacheControl: "public, max-age=31536000, immutable"`
  (la clave cambia si la imagen cambia, así que es seguro cachear "para siempre") y
  `customMetadata: { uploaded_by: <correo>, use }`.
- Respuesta: `{ key, url, size, width, height }`. `url` es solo para la vista previa;
  **lo que se guarda en la fila es la `key`**.
- Se registra en el log de auditoría (`create media/<key>`).

## Reemplazar y borrar

- **Reemplazar** = subir la nueva, guardar la fila con la clave nueva y **solo
  entonces** ofrecer borrar la anterior. Nunca borrar primero: si el guardado
  falla, la fila quedaría apuntando a la nada.
- **Borrar** (`DELETE /media/:key`): el backend recorre las columnas de imagen y
  responde **409 con la lista de dónde se usa** si alguna fila la referencia. Sin
  referencias, borra. R2 no tiene papelera: el borrado es definitivo y pide
  confirmación.
- Al borrar un **proyecto/experiencia/educación**, la pantalla enumera sus
  imágenes que ningún otro registro usa y pregunta si se borran también.
- Las claves heredadas (`/UPVM.webp`, `Backend_Task.webp`) son válidas y se
  muestran en la biblioteca; **no se renombran ni se "normalizan" al guardar** (se
  guardan tal cual vinieron), porque el sitio ya las sirve bien.

## La biblioteca de medios (módulo "Medios")

- Rejilla de miniaturas con carga diferida y esqueleto, ordenada por fecha.
- Por cada objeto: miniatura, clave, tamaño, dimensiones, fecha y **dónde se usa**
  (enlaces a su proyecto/experiencia) o la etiqueta **"Sin uso"**.
- Filtro "Sin uso" y borrado de huérfanas con confirmación, de a una o por lote.
- Selector reutilizable (`<ImagePicker>`) en los formularios: "Subir nueva" o
  "Elegir de la biblioteca". Un campo de imagen **nunca** pide pegar una clave a
  mano.
- Para el CV y la imagen social hay tarjetas dedicadas (PDF y WebP exacto).

## El CV (PDF)

El PDF no es una imagen, pero comparte infraestructura:

- Se sube con `POST /media/cv`: `application/pdf`, ≤ 5 MiB, empieza con `%PDF-`.
  Clave `site/cv-AAAA-MM-DD.pdf` (el nombre lleva la fecha: cada versión es un
  objeto nuevo y se conserva la anterior hasta borrarla).
- Se guarda en `site_settings.cv_key`; el sitio arma el enlace con `mediaUrl()`.
- `Content-Disposition: inline; filename="CV_Erick_Gonzalez.pdf"` para que el
  navegador lo muestre y lo guarde con un nombre decente.
- **Antes de borrar los proyectos de Vercel:** descargar el CV actual de Vercel
  Blob y subirlo por aquí (es el único archivo personal que depende de Vercel).

## Dominio de medios

- `r2.dev` es para pruebas: tiene límite de peticiones y no usa la caché de
  Cloudflare. Para producción: **dominio propio** (`media.khelde.dev`) conectado al
  bucket, con caché del borde, y **desactivar** el acceso `r2.dev`.
- Cambiar el dominio es solo cambiar `PUBLIC_MEDIA_URL` (variable de build del
  portafolio y del admin, variable de runtime del backend): las filas no se tocan
  porque guardan claves.
- El bucket **no** debe tener listado público. Solo los objetos se sirven.

## Qué no hacer

- Subir SVG, GIF animado, HEIC o PDF "como imagen".
- Dejar que el cliente elija la clave o la carpeta.
- Guardar URLs completas en la base.
- Servir las imágenes a través del Worker del admin: se sirven directo desde R2.
- Redimensionar "al vuelo" en el sitio: las imágenes ya se guardan en su tamaño de
  uso.

## Pruebas

- **Cliente (Vitest + jsdom):** la función de conversión con un canvas simulado
  (tamaño máximo, calidad decreciente, rechazo cuando `blob.type` no es WebP).
- **Backend (integración con R2 simulado de Miniflare):** rechaza un PNG con
  `Content-Type: image/webp`, rechaza un cuerpo sin `RIFF…WEBP`, rechaza > 2 MiB,
  genera una clave `<area>/<uuid>.webp`, devuelve 409 al borrar una imagen en uso.
- **E2E (Playwright):** subir un archivo de ejemplo, verlo en la biblioteca y
  reemplazarlo en un proyecto.
