import { useEffect, useState } from "react";
import { formatDateTime, parseD1Date } from "@/lib/format";

interface Props {
	/** Texto de D1 (`YYYY-MM-DD HH:MM:SS`, UTC) o una fecha ISO. */
	value: string | null | undefined;
	className?: string;
}

/**
 * Muestra una fecha en la zona del navegador. El servidor pinta el valor en UTC
 * y el cliente lo reemplaza al hidratar, asi no hay diferencia entre ambos.
 */
export const LocalTime = ({ value, className }: Props) => {
	const date = parseD1Date(value);
	const [text, setText] = useState(() =>
		date ? `${date.toISOString().slice(0, 16).replace("T", " ")} UTC` : "—",
	);

	useEffect(() => {
		setText(formatDateTime(date));
	}, [date]);

	return (
		<time dateTime={date?.toISOString()} className={className}>
			{text}
		</time>
	);
};
