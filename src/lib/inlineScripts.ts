/**
 * Script EN LINEA del <head>. Corre antes del primer pintado (por eso no puede ser un
 * modulo: uno se aplaza y el tema parpadearia). Astro no calcula el hash de los
 * `is:inline`, asi que el texto vive aqui y lo usan los dos lados:
 *  - `Layout.astro` lo escribe tal cual (`set:html`);
 *  - `astro.config.mjs` calcula su sha256 y lo agrega al `script-src` del CSP.
 * Misma logica que `src/lib/theme.ts`. Si cambias una letra, el hash cambia solo
 * en el siguiente build.
 */

/** Tema guardado ("light" | "dark") o el del sistema, antes de pintar. */
export const THEME_SCRIPT = `(function(){var dark=window.matchMedia("(prefers-color-scheme: dark)").matches;try{var stored=localStorage.getItem("theme");if(stored==="light"||stored==="dark")dark=stored==="dark"}catch(_){}document.documentElement.classList.toggle("dark",dark);document.documentElement.style.colorScheme=dark?"dark":"light"})();`;
