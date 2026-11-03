# Plan del CMS — índice y resumen

Este plan reúne **todo lo que hay que decidir y construir** para que el admin
reemplace por completo los cambios de contenido que hoy se suben al repo del
portafolio. Está escrito contra el código real de los tres repos, no contra
suposiciones; donde algo no se pudo comprobar se marca como **[verificar]**.

| Repo | Versión leída | Papel |
|---|---|---|
| `Portafolio_Admin` (este) | 0.3.0 | el CMS, solo para su dueño |
| `Backend_Portafolio` | 0.10.0 | API de contenido: Hono + D1 + R2 (única que escribe datos) |
| `Portafolio` | 3.14.0 | sitio público; lee del backend, sin base propia |

## Cómo leer este plan

| # | Capítulo | Responde a |
|---|---|---|
| 01 | [Visión, alcance y contenido estático](./01-vision-y-alcance.md) | qué se construye, qué no, y qué sigue fijo en el repo del portafolio |
| 02 | [Base de datos](./02-base-de-datos.md) | qué tablas se usan, cuáles no, cuáles se agregan, la tabla de usuarios |
| 03 | [Backend y conexión](./03-backend-y-conexion.md) | endpoints que existen, los que faltan, flujo y contratos |
| 04 | [Zero Trust, sesión y cierre de sesión](./04-zero-trust-y-sesion.md) | Cloudflare Access, verificación del JWT, logout |
| 05 | [Imágenes y R2](./05-imagenes-r2.md) | todo se sube en WebP: conversión, validación, claves, borrado |
| 06 | [Validaciones con Zod](./06-validaciones-zod.md) | reglas por formulario y mapeo de errores |
| 07 | [Módulos y pantallas](./07-modulos-y-pantallas.md) | el acomodo del menú y qué hace cada módulo |
| 08 | [UI, tema y accesibilidad](./08-ui-tema-y-accesibilidad.md) | cómo se aplica `UI_STANDARDS.md`, cambio de tema, componentes |
| 09 | [Pruebas, CI y despliegue](./09-pruebas-ci-y-despliegue.md) | calidad, variables, costos, respaldos, dominio |
| 10 | [Seguridad y riesgos](./10-seguridad-y-riesgos.md) | amenazas y mitigaciones |
| 11 | [Roadmap por fases](./11-roadmap.md) | orden de construcción, PR por PR, con criterios de aceptación |
| 12 | [Decisiones abiertas](./12-decisiones-abiertas.md) | lo que hay que resolver contigo |

## Resumen ejecutivo

- **Un solo usuario** (su dueño). No hay roles, registro ni recuperación de
  contraseña. La identidad la da **Cloudflare Access**; el admin no tiene
  pantalla de login y verifica el JWT que Access le manda.
- **El contenido ya es dinámico** en siete tablas de D1. El CMS no crea un
  modelo nuevo: le pone una interfaz a lo que el backend ya expone (rutas
  `/admin`, `POST`, `PUT`, `DELETE` detrás de Access).
- **Lo que falta en el backend** antes de que el CMS sea completo: subida y
  borrado de imágenes en R2 (hoy no existe ninguna ruta), una tabla de ajustes
  del sitio (enlaces, CV, WhatsApp) y reordenamiento en lote.
- **La tabla `users` ya no se usa.** Existió en Turso; no se migró a D1 y no se
  recrea: Access la reemplaza. Ver [cap. 02](./02-base-de-datos.md#la-tabla-de-usuarios).
- **Todas las imágenes se guardan en WebP.** Se convierten en el navegador
  (canvas) antes de subir y el backend rechaza cualquier otra cosa. Ver
  [cap. 05](./05-imagenes-r2.md).
- **Sin animaciones complejas.** Es un sistema, no una vista de lucimiento:
  transiciones de hover cortas, esqueletos de carga y nada de GSAP.
- **Cero costos sorpresa.** Sin cron, colas, Durable Objects ni Workflows. Todo
  cabe en los planes gratuitos con holgura (ver [cap. 09](./09-pruebas-ci-y-despliegue.md#costos)).

## Decisiones ya tomadas

Estas no se vuelven a discutir en cada PR; si cambian, se cambian aquí.

| Tema | Decisión |
|---|---|
| Identidad | Cloudflare Access + verificación del JWT en el admin **y** en el backend |
| Usuarios | Uno solo; sin tabla `users` |
| Escritura de datos | Solo el backend. El admin no tiene binding a D1 ni a R2 |
| Navegador → backend | Nunca directo; solo rutas `/api/*` del mismo origen del admin |
| Formato de imagen | WebP, convertido en el cliente, validado en el servidor |
| Idiomas del contenido | es (base) + en + fr, en la misma fila (`translations`) |
| Idioma de la interfaz | Solo español |
| Estilo | `docs/UI_STANDARDS.md` (paleta, tipografía, shadcn, Lucide) |
| Animación | Mínima: hover táctil, skeletons; sin GSAP |
| Cliente HTTP | `fetch` nativo, sin axios (el error de axios trae el token) |

## Estado de lo verificado

Leído directamente de código: rutas y política de acceso del backend
(`tests/security/routeInventory.test.ts`), esquemas Zod y tablas Drizzle,
middleware de Access, CORS/CSRF, contenido estático del portafolio (`Header`,
`Footer`, `Form`, `Layout`, i18n), y las cantidades de filas del respaldo de
Turso del 2026-11-02.

No verificado (se prueba al construir): el comportamiento exacto de
Cloudflare Access sobre `workers.dev`, el parámetro `returnTo` del cierre de
sesión y la revocación de sesiones desde el panel de Zero Trust.
