import { Menu } from "lucide-react";
import { NavList } from "@/components/NavList";
import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";

interface Props {
	activeId: string;
	badges?: Record<string, number>;
}

/** Menu del movil: el mismo `NavList` dentro de un panel lateral. */
export const MobileNav = ({ activeId, badges }: Props) => (
	<Sheet>
		<SheetTrigger
			render={
				<Button
					type="button"
					variant="outline"
					size="icon"
					className="size-11 lg:hidden"
					aria-label="Abrir el menú"
				/>
			}
		>
			<Menu aria-hidden="true" />
		</SheetTrigger>
		<SheetContent side="left" className="w-72 overflow-y-auto">
			<SheetHeader>
				<SheetTitle className="font-serif-display text-heading">
					Khelde
				</SheetTitle>
			</SheetHeader>
			<div className="px-3 pb-6">
				<NavList activeId={activeId} badges={badges} />
			</div>
		</SheetContent>
	</Sheet>
);
