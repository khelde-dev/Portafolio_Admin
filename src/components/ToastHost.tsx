import { Toaster } from "react-hot-toast";

/**
 * Avisos breves ("Guardado"). Solo confirman; un error que bloquea el trabajo
 * va en la pagina (ErrorState / aviso del formulario), no en un aviso que se va.
 * Los colores salen de los tokens, asi que siguen al tema claro/oscuro.
 */
export const ToastHost = () => (
	<Toaster
		position="bottom-right"
		toastOptions={{
			duration: 3500,
			ariaProps: { role: "status", "aria-live": "polite" },
			style: {
				background: "var(--card)",
				color: "var(--card-foreground)",
				border: "1px solid var(--border)",
				borderRadius: "var(--radius-lg)",
				fontSize: "0.9375rem",
				padding: "0.625rem 0.875rem",
			},
			iconTheme: {
				primary: "var(--primary)",
				secondary: "var(--primary-foreground)",
			},
		}}
	/>
);
