import {
	ROUTE_SEGMENTS,
	ROUTE_STROKE_WIDTH_PX,
	ROUTE_VIEW_BOX,
} from "./constants";

interface RouteDiagramProps {
	label: string;
	title: string;
}

export function RouteDiagram({ label, title }: RouteDiagramProps) {
	return (
		<svg
			viewBox={ROUTE_VIEW_BOX}
			className="w-full"
			role="img"
			aria-label={label}
		>
			<title>{title}</title>
			{ROUTE_SEGMENTS.map((segment) => (
				<polyline
					key={segment.className}
					points={segment.points}
					className={segment.className}
					fill="none"
					strokeLinecap="round"
					strokeLinejoin="round"
					strokeWidth={ROUTE_STROKE_WIDTH_PX}
				/>
			))}
		</svg>
	);
}
