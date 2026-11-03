import type { ReactNode } from "react";

/**
 * Una seccion de un formulario: titulo y explicacion a la izquierda, campos a
 * la derecha, separadas por un filete. En el movil se apilan. Es estructura,
 * no decoracion: agrupa lo que se edita junto.
 */
export const FormSection = ({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) => (
	<section className="grid gap-5 border-t border-border pt-8 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-10">
		<header>
			<h2 className="font-serif-display text-heading">{title}</h2>
			{description ? (
				<p className="mt-2 text-sm text-muted-foreground">{description}</p>
			) : null}
		</header>
		<div className="flex min-w-0 flex-col gap-6">{children}</div>
	</section>
);
