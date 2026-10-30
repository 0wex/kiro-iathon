import type { RouteSignalKind } from "@hack-the-andes-project/business/route-review/risk";
import { SignalBaseline, SignalConfirmed, SignalForecast } from "./icons";

interface RouteReviewSignalTagProps {
	kind: RouteSignalKind;
	label: string;
}
const signalIcons = {
	confirmed: SignalConfirmed,
	forecast: SignalForecast,
	baseline: SignalBaseline,
};
export function RouteReviewSignalTag({
	kind,
	label,
}: RouteReviewSignalTagProps) {
	const Icon = signalIcons[kind];
	return (
		<span className="inline-flex items-center gap-1 text-xs">
			<Icon className="size-4 shrink-0" aria-hidden="true" />
			{label}
		</span>
	);
}
