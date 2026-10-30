import {
	INCIDENT_SEVERITY_LABELS,
	INCIDENT_SEVERITY_OPTIONS,
} from "@hack-the-andes-project/ui/lib/incident-constants";
import { cn } from "@hack-the-andes-project/ui/lib/utils";

import { SeverityDot } from "./severity";

export interface MapLegendProps {
	className?: string;
}

export function MapLegend({ className }: MapLegendProps) {
	return (
		<section
			aria-label="Leyenda de severidad"
			className={cn(
				"type-label flex flex-wrap items-center gap-3 rounded-lg border border-border bg-popover px-3 py-2 backdrop-blur-sm",
				className,
			)}
		>
			<span className="text-muted-foreground">Severidad</span>
			{INCIDENT_SEVERITY_OPTIONS.map((severity) => (
				<span key={severity} className="flex items-center gap-1.5">
					<SeverityDot severity={severity} />
					{INCIDENT_SEVERITY_LABELS[severity]}
				</span>
			))}
		</section>
	);
}
