import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * Elige una opcion de un `Select` de shadcn (Base UI): abre el selector por su
 * etiqueta y pulsa la opcion por su texto. Reemplaza a `selectOptions`, que solo
 * sirve para un `<select>` nativo.
 */
export const choose = async (
	label: string | RegExp,
	option: string | RegExp,
): Promise<void> => {
	await userEvent.click(screen.getByLabelText(label));
	await userEvent.click(await screen.findByRole("option", { name: option }));
};
