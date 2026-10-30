import {
	Toast,
	ToastClose,
	ToastContent,
	ToastDescription,
	ToastPortal,
	ToastTitle,
	ToastViewport,
	useToastManager,
} from "@hack-the-andes-project/ui/components/toast";

interface ShowcaseToastViewportProps {
	closeLabel: string;
}

export function ShowcaseToastViewport({
	closeLabel,
}: ShowcaseToastViewportProps) {
	const { toasts } = useToastManager();
	return (
		<ToastPortal>
			<ToastViewport>
				{toasts.map((notification) => (
					<Toast key={notification.id} toast={notification}>
						<ToastContent>
							<div className="flex min-w-0 flex-1 flex-col gap-1">
								<ToastTitle />
								<ToastDescription />
							</div>
							<ToastClose aria-label={closeLabel} />
						</ToastContent>
					</Toast>
				))}
			</ToastViewport>
		</ToastPortal>
	);
}
