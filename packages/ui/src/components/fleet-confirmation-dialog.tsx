import { Alert, AlertDescription, AlertTitle } from "./alert";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./alert-dialog";

export interface FleetConfirmationDialogProps {
	open: boolean;
	title: string;
	description: string;
	actionLabel: string;
	pendingLabel: string;
	cancelLabel: string;
	errorTitle: string;
	actionVariant: "default" | "destructive";
	isPending: boolean;
	error: Error | null;
	onConfirm: () => void;
	onClose: () => void;
}

export function FleetConfirmationDialog({
	open,
	title,
	description,
	actionLabel,
	pendingLabel,
	cancelLabel,
	errorTitle,
	actionVariant,
	isPending,
	error,
	onConfirm,
	onClose,
}: FleetConfirmationDialogProps) {
	return (
		<AlertDialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen && !isPending) onClose();
			}}
		>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>
				{error && (
					<Alert variant="destructive">
						<AlertTitle>{errorTitle}</AlertTitle>
						<AlertDescription>{error.message}</AlertDescription>
					</Alert>
				)}
				<AlertDialogFooter>
					<AlertDialogCancel className="min-h-11" disabled={isPending}>
						{cancelLabel}
					</AlertDialogCancel>
					<AlertDialogAction
						className="min-h-11"
						variant={actionVariant}
						disabled={isPending}
						onClick={onConfirm}
					>
						{isPending ? pendingLabel : actionLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
