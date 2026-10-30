import type { RouteRiskLevel } from "@hack-the-andes-project/business/route-review/risk";
import { cn } from "cn";
import { Badge } from "./badge";

export interface RouteReviewRiskBadgeProps {
	level: RouteRiskLevel;
	label: string;
	score?: number;
	horizonLabel?: string;
	emphasis?: "primary" | "secondary";
}

const riskDotClasses: Record<RouteRiskLevel, string> = {
	low: "bg-risk-low",
	moderate: "bg-risk-moderate",
	high: "bg-risk-high",
	critical: "bg-risk-critical",
};

export function RouteReviewRiskBadge({
	level,
	label,
	score,
	horizonLabel,
	emphasis = "primary",
}: RouteReviewRiskBadgeProps) {
	return (
		<Badge variant={emphasis === "primary" ? level : "outline"}>
			{horizonLabel ? <span>{horizonLabel} · </span> : null}
			{emphasis === "secondary" ? (
				<span
					aria-hidden="true"
					className={cn(
						"size-2 rounded-full ring-1 ring-foreground/30",
						riskDotClasses[level],
					)}
				/>
			) : null}
			{label}
			{score === undefined ? null : ` · ${score}`}
		</Badge>
	);
}
