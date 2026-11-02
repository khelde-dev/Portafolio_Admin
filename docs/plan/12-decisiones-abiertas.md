# 12 · Decisiones abiertas

Cosas que **no** se pueden resolver leyendo el código y necesitan tu criterio. Cada
una trae las opciones y una **recomendación**; si no dices otra cosa, se toma la
recomendada cuando llegue su fase. Se tachan al decidirlas.

| # | Decisión | Fase en que se necesita | Recomendación |
|---|---|---|---|
| 1 | ¿Cuál es el **número de WhatsApp** correcto? | 6 | ver abajo |
| 2 | ¿**Un CV** o uno por idioma? | 6 | uno |
| 3 | ¿Los **textos del hero y el manifiesto** pasan al CMS? | 6–8 | no por ahora |
| 4 | ¿**Service Binding** al backend ya o después? | 8 | después |
| 5 | ¿**Token exclusivo** del admin? | 8 | después |
| 6 | ¿Cuándo **autoalojar los íconos** de tecnologías? | 8 | con la fase 5 ya hecha |
| 7 | ¿**Reordenar** con botones o arrastrando? | 4 | botones |
| 8 | ¿**Borrado definitivo** de comentarios? | 2 | solo desde "Ocultos" |
| 9 | ¿Cuándo comprar el **dominio** y qué subdominios? | 8 | cuando haya presupuesto; `admin.`, `media.`, `api.` |
| 10 | ¿El `alt` de Experiencia se **traduce**? | 5 | sí, si molesta |
| 11 | ¿**Vista previa de borradores**? | 4 | no; enlace al sitio solo si está publicado |
| 12 | ¿Retención del **historial** (1 000 filas)? | 7 | suficiente |
| 13 | ¿Cierre de sesión con **`returnTo`**? | 1 | probar; si no, pantalla de Access |
| 14 | Navegador de uso: ¿**solo Chrome/Edge/Firefox**? | 3 | sí (WebP en canvas) |

## Detalle

### 1 · Número de WhatsApp

El sitio tiene **dos números distintos**: el botón del hero (`Header.astro`) y el
del formulario de contacto (`Form.tsx`) apuntan a líneas diferentes. Uno de los
dos está mal o son dos líneas a propósito. En Ajustes hay un **solo** campo; si de
verdad quieres dos (uno para el hero y otro para el formulario), se agregan dos
campos. **Necesito saber cuál es el correcto.** (Los números no se copian en este
documento: el repo es público.)

### 2 · CV por idioma

Hoy hay un solo PDF. Un CV por idioma (`cv_key_es/en/fr`) es mejor para quien lo
lee, pero obliga a mantener tres archivos. Recomendación: empezar con uno; el
esquema se amplía después sin romper nada (columnas nuevas con valor por defecto).

### 3 · Textos personales en el CMS

Los títulos del hero y el manifiesto cambian pocas veces al año. Moverlos a la base
cuesta una tabla, una ruta, una pantalla y lógica de respaldo en el sitio; dejarlos
en el repo cuesta un commit pequeño de vez en cuando. Si la meta es **no volver a
tocar el repo nunca**, se hace; si basta con "el contenido que cambia seguido",
se queda. Recomendación: no, y reevaluar al terminar la fase 6.

### 4 y 5 · Service Binding y token propio

Son mejoras de seguridad y de limpieza, **no de funcionalidad**. Con Access como
puerta real, el bearer compartido es aceptable. Se hacen cuando el resto esté
estable, para no mover tres Workers a la vez.

### 6 · Íconos

El sitio depende de `go-skill-icons.vercel.app`. Si ese servicio cambia o cae, los
íconos se rompen. Autoalojarlos (archivos SVG en R2) es barato y elimina una
dependencia y un origen del CSP. Se hace después de que el selector de tecnologías
exista (fase 5), porque es ahí donde se sabe qué íconos hacen falta de verdad.

### 7 · Reordenar

Los botones Subir/Bajar son accesibles y no añaden dependencias. Arrastrar y soltar
requiere una librería y tiene una versión de teclado difícil de hacer bien. Con 21
proyectos, 11 habilidades y 5 experiencias, los botones sobran.

### 8 · Borrar comentarios

`hidden` casi siempre basta. El borrado real solo hace falta por spam o por datos
personales que alguien pida retirar. Se agrega `DELETE /comments/:id` en el
backend y el botón aparece **solo** en la pestaña "Ocultos", con confirmación.

### 9 · Dominio

`khelde.dev` cuesta ~8 USD el primer año y ~12 USD al renovar. Nada de este plan
**depende** de él: todas las URLs son variables y todo funciona en `workers.dev`.
Cuando se compre: `khelde.dev` (portafolio), `admin.khelde.dev`,
`media.khelde.dev` (R2) y `api.khelde.dev` (backend). Pasos en el cap. 04
("Cuando haya dominio propio") y en la fase 8.

### 10–12

Menores; se deciden al llegar a su fase. El `alt` traducible es un cambio de una
línea en el esquema del backend. La vista previa de borradores se podría hacer con
una ruta del sitio que acepte un token firmado, pero es mucho para un solo usuario.
La retención de 1 000 filas de historial cubre años de uso de una persona.

### 13 · `returnTo` en el cierre de sesión

Cloudflare documenta el cierre de sesión por `/cdn-cgi/access/logout`; si admite
volver a una URL concreta con `returnTo` se comprueba en la fase 1. No cambia el
diseño: sin él, la persona ve la pantalla de Access al salir.

### 14 · Navegador

La conversión a WebP usa `canvas.toBlob("image/webp")`. Chrome, Edge y Firefox lo
codifican; Safari devuelve PNG y el admin lo detecta y se niega a subirlo. Si algún
día se necesitara subir desde Safari, se añade un codificador WebP en Wasm
(`@jsquash/webp`) en el cliente: no cambia nada del servidor.

## Preguntas que sí necesito de ti ahora

1. El **número de WhatsApp** correcto (decisión 1).
2. Cuándo quieres activar **Cloudflare Access** (fase 1): es lo primero que hay que
   hacer en el panel de Cloudflare y desbloquea todo lo demás.
3. Si **el CV de Vercel Blob** sigue siendo el vigente, para subirlo en la fase 6.
