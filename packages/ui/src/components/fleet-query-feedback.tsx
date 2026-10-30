import type { ReactNode } from "react";

import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Button } from "./button";
import { Skeleton } from "./skeleton";

export interface FleetQueryFeedbackProps {
	skeleton?: ReactNode;
	labels?: {
		errorTitle: string;
		errorDescription: string;
		retry: string;
		loading: string;
	};
	isPending: boolean;
	isError: boolean;
	onRetry: () => void;
}

export function FleetQueryFeedback({
	skeleton,
	labels,
	isPending,
	isError,
	onRetry,
}: FleetQueryFeedbackProps) {
	if (isError)
		return (
			<Alert variant="destructive">
				<AlertTitle>
					{labels?.errorTitle ?? "No se pudieron actualizar los datos"}
				</AlertTitle>
				<AlertDescription>
					{labels?.errorDescription ??
						"Verifica tu conexión. Si hay datos anteriores, se muestran a continuación."}
					<Button variant="link" className="min-h-11" onClick={onRetry}>
						{labels?.retry ?? "Reintentar"}
					</Button>
				</AlertDescription>
			</Alert>
		);
	if (isPending)
		return (
			<output
				aria-label={labels?.loading ?? "Cargando datos"}
				className="flex flex-col gap-3"
			>
				{skeleton ?? (
					<>
						<Skeleton className="h-16 w-full" />
						<Skeleton className="h-16 w-full" />
					</>
				)}
			</output>
		);
	return null;
}
