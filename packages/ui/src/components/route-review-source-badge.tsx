import { Badge } from "./badge";

export interface RouteReviewSourceBadgeProps {
	source: "illapa" | "sutran";
	label: string;
}

export function RouteReviewSourceBadge({
	source,
	label,
}: RouteReviewSourceBadgeProps) {
	return (
		<Badge
			variant="outline"
			className={source === "sutran" ? "border-dashed" : "border-solid"}
		>
			{label}
		</Badge>
	);
}
