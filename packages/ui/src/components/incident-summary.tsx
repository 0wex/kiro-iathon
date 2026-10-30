import type { IncidentSeverityCount } from "@hack-the-andes-project/ui/lib/incident";
import {
	INCIDENT_SEVERITY_LABELS,
	INCIDENT_SEVERITY_OPTIONS,
} from "@hack-the-andes-project/ui/lib/incident-constants";

import { SeverityDot } from "./severity";
import { Skeleton } from "./skeleton";

export interface IncidentSummaryProps {
	counts?: IncidentSeverityCount[];
	isPending: boolean;
	isError: boolean;
}

export function IncidentSummary({
	counts,
	isPending,
	isError,
}: IncidentSummaryProps) {
	return (
		<section
			aria-label="Resumen nacional de incidentes activos"
			aria-busy={isPending}
			className="type-label flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 border-b bg-muted/30 px-4 py-2"
		>
			<span className="text-muted-foreground">
				Activos en Perú · sin filtros
			</span>
			{INCIDENT_SEVERITY_OPTIONS.map((severity) => (
				<span key={severity} className="flex items-center gap-2">
					<SeverityDot severity={severity} />
					<span>{INCIDENT_SEVERITY_LABELS[severity]}</span>
					{isPending ? (
						<Skeleton className="h-4 w-6" />
					) : (
						<strong className="type-data">
							{isError
								? "—"
								: (counts?.find((item) => item.severity === severity)?.count ??
									0)}
						</strong>
					)}
				</span>
			))}
			{isError && (
				<span className="text-muted-foreground">Resumen no disponible</span>
			)}
		</section>
	);
}
