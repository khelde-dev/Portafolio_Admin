import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Nombre del elemento: el aviso dice exactamente que se borra. */
	name: string;
	/** Lo que pasa ademas ("Sus imagenes no se borran de R2"). */
	consequence?: string;
	confirmLabel?: string;
	busy?: boolean;
	onConfirm: () => void;
}

/**
 * Confirmacion de TODO borrado. Dice el nombre del elemento y que no se puede
 * deshacer; el foco empieza en "Cancelar" (la opcion segura).
 */
export const ConfirmDelete = ({
	open,
	onOpenChange,
	name,
	consequence = "Esta acción no se puede deshacer.",
	confirmLabel = "Borrar",
	busy = false,
	onConfirm,
}: Props) => (
	<AlertDialog open={open} onOpenChange={onOpenChange}>
		<AlertDialogContent>
			<AlertDialogHeader>
				<AlertDialogTitle>¿Borrar «{name}»?</AlertDialogTitle>
				<AlertDialogDescription>{consequence}</AlertDialogDescription>
			</AlertDialogHeader>
			<AlertDialogFooter>
				<AlertDialogCancel autoFocus>Cancelar</AlertDialogCancel>
				<AlertDialogAction
					variant="destructive"
					disabled={busy}
					onClick={onConfirm}
				>
					{busy ? "Borrando…" : confirmLabel}
				</AlertDialogAction>
			</AlertDialogFooter>
		</AlertDialogContent>
	</AlertDialog>
);
