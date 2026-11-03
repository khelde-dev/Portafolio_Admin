import { Toaster } from "@/components/Toaster";

/**
 * Avisos breves ("Guardado"). Solo confirman; un error que bloquea el trabajo
 * va en la pagina (ErrorState / aviso del formulario), no en un aviso que se va.
 * Los colores salen de los tokens, asi que siguen al tema claro/oscuro. No
 * escribe estilos en la pagina (un CSP con hashes no lo permitiria).
 */
export const ToastHost = () => <Toaster closeLabel="Cerrar aviso" />;
