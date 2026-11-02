import { Check, Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	applyThemePref,
	readThemePref,
	saveThemePref,
	type ThemePref,
	watchSystemTheme,
} from "@/lib/theme";

const OPTIONS: { value: ThemePref; label: string; icon: typeof Sun }[] = [
	{ value: "system", label: "Sistema", icon: Monitor },
	{ value: "light", label: "Claro", icon: Sun },
	{ value: "dark", label: "Oscuro", icon: Moon },
];

/** Selector de tema. "Sistema" sigue en vivo al sistema operativo. */
export const ThemeMenu = () => {
	const [pref, setPref] = useState<ThemePref>("system");

	useEffect(() => {
		setPref(readThemePref());
	}, []);

	useEffect(() => {
		if (pref !== "system") return;
		return watchSystemTheme(() => applyThemePref("system"));
	}, [pref]);

	const choose = (next: ThemePref) => {
		setPref(next);
		saveThemePref(next);
		applyThemePref(next);
	};

	const current = OPTIONS.find((o) => o.value === pref) ?? OPTIONS[0];
	const Icon = current.icon;

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={
					<Button
						type="button"
						variant="outline"
						size="icon"
						className="size-11"
						aria-label={`Tema: ${current.label}. Cambiar tema`}
					/>
				}
			>
				<Icon aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-44">
				{OPTIONS.map(({ value, label, icon: OptionIcon }) => (
					<DropdownMenuItem
						key={value}
						onClick={() => choose(value)}
						className="min-h-10 gap-3"
					>
						<OptionIcon aria-hidden="true" className="size-4" />
						<span>{label}</span>
						{pref === value ? (
							<Check
								aria-hidden="true"
								className="ml-auto size-4 text-primary"
							/>
						) : null}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
