import { INCIDENT_SEVERITY_LABELS } from "@hack-the-andes-project/ui/lib/incident-constants";
import { cn } from "@hack-the-andes-project/ui/lib/utils";

import { Badge } from "./badge";

export interface SeverityProps {
	severity: keyof typeof INCIDENT_SEVERITY_LABELS;
	className?: string;
}

export function SeverityDot({ severity, className }: SeverityProps) {
	return (
		<span
			aria-hidden="true"
			className={cn(
				"inline-block size-2 shrink-0 rounded-full",
				severity === "critical" && "bg-risk-critical",
				severity === "warning" && "bg-risk-high",
				severity === "info" && "bg-info",
				className,
			)}
		/>
	);
}

export function SeverityBadge({ severity, className }: SeverityProps) {
	return (
		<Badge
			variant={severity === "warning" ? "high" : severity}
			className={className}
		>
			{INCIDENT_SEVERITY_LABELS[severity]}
		</Badge>
	);
}
