import { ROUTE_RISK_LEVELS } from "@hack-the-andes-project/business/route-review/risk";
import type { RouteReviewLabels } from "../lib/route-review";
import { RouteReviewRiskBadge } from "./route-review-risk-badge";
import { RouteReviewSignalTag } from "./route-review-signal-tag";
import { RouteReviewSourceBadge } from "./route-review-source-badge";

interface RouteReviewLegendProps {
	horizonLabel: string;
	labels: RouteReviewLabels;
}
export function RouteReviewLegend({
	horizonLabel,
	labels,
}: RouteReviewLegendProps) {
	return (
		<div className="flex flex-col gap-2 rounded-lg border bg-card p-3 text-card-foreground">
			<p className="type-label">
				{labels.risk} · {horizonLabel}
			</p>
			<div className="flex flex-wrap gap-2">
				{ROUTE_RISK_LEVELS.map((level) => (
					<RouteReviewRiskBadge
						key={level}
						level={level}
						label={labels.riskLevel(level)}
						emphasis="secondary"
					/>
				))}
			</div>
			<div className="flex flex-wrap gap-3">
				<RouteReviewSourceBadge
					source="illapa"
					label={labels.source("illapa")}
				/>
				<RouteReviewSourceBadge
					source="sutran"
					label={labels.source("sutran")}
				/>
				<RouteReviewSignalTag
					kind="confirmed"
					label={labels.signalKind("confirmed")}
				/>
				<RouteReviewSignalTag
					kind="forecast"
					label={labels.signalKind("forecast")}
				/>
			</div>
		</div>
	);
}
