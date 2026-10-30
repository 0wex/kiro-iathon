import type { INCIDENT_CATEGORY_LABELS } from "@hack-the-andes-project/ui/lib/incident-constants";
import { cn } from "@hack-the-andes-project/ui/lib/utils";
import type { ComponentType, SVGProps } from "react";

export interface IncidentIconProps extends SVGProps<SVGSVGElement> {}

function IncidentIcon({ className, children, ...props }: IncidentIconProps) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			className={cn("size-6", className)}
			{...props}
		>
			{children}
		</svg>
	);
}

export function RoadAccidentIcon(props: IncidentIconProps) {
	return (
		<IncidentIcon {...props}>
			<path d="M4.5 16.5H3a1 1 0 0 1-1-1v-2.6a1 1 0 0 1 .3-.7L5 9.5h6l3 3h1.5a1.5 1.5 0 0 1 1.5 1.5v1.5a1 1 0 0 1-1 1h-1" />
			<path d="M7.5 16.5h4.5" />
			<circle cx="6" cy="16.5" r="1.5" />
			<circle cx="13.5" cy="16.5" r="1.5" />
			<path d="M19 2v2.5" />
			<path d="M22 6.5h-2.5" />
			<path d="M21.5 3l-1.8 1.8" />
			<path d="M16 3.5l1.2 1.2" />
		</IncidentIcon>
	);
}

export function RoadWorksIcon(props: IncidentIconProps) {
	return (
		<IncidentIcon {...props}>
			<path d="M10.2 4h3.6l4.2 15H6z" />
			<path d="M8.6 10h6.8" />
			<path d="M7.4 14.5h9.2" />
			<path d="M3.5 19h17" />
		</IncidentIcon>
	);
}

export function RoadBlockIcon(props: IncidentIconProps) {
	return (
		<IncidentIcon {...props}>
			<rect x="2" y="7" width="20" height="6" rx="1" />
			<path d="M8 7l-4 6" />
			<path d="M14 7l-4 6" />
			<path d="M20 7l-4 6" />
			<path d="M5 13v7" />
			<path d="M19 13v7" />
			<path d="M3 20h4" />
			<path d="M17 20h4" />
		</IncidentIcon>
	);
}

export function LandslideIcon(props: IncidentIconProps) {
	return (
		<IncidentIcon {...props}>
			<path d="M2 20L9.5 6l3.5 6" />
			<circle cx="15.5" cy="13.5" r="1.5" />
			<circle cx="19" cy="17.5" r="1.5" />
			<path d="M2 20h20" />
		</IncidentIcon>
	);
}

export function FloodIcon(props: IncidentIconProps) {
	return (
		<IncidentIcon {...props}>
			<path d="M4 10l8-6 8 6" />
			<path d="M6 8.5V13" />
			<path d="M18 8.5V13" />
			<path d="M2 15.5c1.7 0 1.7 1.5 3.3 1.5s1.7-1.5 3.3-1.5 1.7 1.5 3.4 1.5 1.7-1.5 3.3-1.5 1.7 1.5 3.4 1.5 1.6-1.5 3.3-1.5" />
			<path d="M2 19.5c1.7 0 1.7 1.5 3.3 1.5s1.7-1.5 3.3-1.5 1.7 1.5 3.4 1.5 1.7-1.5 3.3-1.5 1.7 1.5 3.4 1.5 1.6-1.5 3.3-1.5" />
		</IncidentIcon>
	);
}

export function FireIcon(props: IncidentIconProps) {
	return (
		<IncidentIcon {...props}>
			<path d="M12 22a7 7 0 0 0 7-7c0-4-3-6.5-4-10-1.5 1.5-2.5 3.5-2.5 5.5-1-.8-1.8-2-2-3.5C8.5 8.5 5 11 5 15a7 7 0 0 0 7 7z" />
			<path d="M12 22a3 3 0 0 1-3-3c0-2 1.5-3 3-5 1.5 2 3 3 3 5a3 3 0 0 1-3 3z" />
		</IncidentIcon>
	);
}

export function WildfireIcon(props: IncidentIconProps) {
	return (
		<IncidentIcon {...props}>
			<path d="M8 2L3.5 9H6l-3 5h10l-3-5h2.5z" />
			<path d="M8 14v7" />
			<path d="M17 21a4 4 0 0 0 4-4c0-2.2-1.7-3.4-2.3-5.5-.9.8-1.5 2-1.5 3.2-.6-.4-1-1.1-1.2-2C14.8 13.6 13 15 13 17a4 4 0 0 0 4 4z" />
		</IncidentIcon>
	);
}

export function EarthquakeIcon(props: IncidentIconProps) {
	return (
		<IncidentIcon {...props}>
			<path d="M2 12h4l2-5 3 10 3-14 2.5 12 1.5-3h4" />
			<path d="M2 21h20" />
		</IncidentIcon>
	);
}

export function WeatherIcon(props: IncidentIconProps) {
	return (
		<IncidentIcon {...props}>
			<path d="M17.5 17H18a4 4 0 0 0 0-8h-.5A6 6 0 0 0 6 10.5 3.5 3.5 0 0 0 6.5 17" />
			<path d="M12.5 12L10 16.5h4L11.5 21" />
		</IncidentIcon>
	);
}

export function MedicalIcon(props: IncidentIconProps) {
	return (
		<IncidentIcon {...props}>
			<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />
		</IncidentIcon>
	);
}

export function RescueIcon(props: IncidentIconProps) {
	return (
		<IncidentIcon {...props}>
			<circle cx="12" cy="12" r="10" />
			<circle cx="12" cy="12" r="4" />
			<path d="M4.93 4.93l4.24 4.24" />
			<path d="M14.83 14.83l4.24 4.24" />
			<path d="M14.83 9.17l4.24-4.24" />
			<path d="M4.93 19.07l4.24-4.24" />
		</IncidentIcon>
	);
}

export function HazmatIcon(props: IncidentIconProps) {
	return (
		<IncidentIcon {...props}>
			<path d="M12 2l10 10-10 10L2 12z" />
			<path d="M10.5 8h3" />
			<path d="M11 8v3l-2.5 4.5h7L13 11V8" />
		</IncidentIcon>
	);
}

export function RainWarningIcon(props: IncidentIconProps) {
	return (
		<IncidentIcon {...props}>
			<path d="M17.5 15H18a4 4 0 0 0 0-8h-.5A6 6 0 0 0 6 8.5 3.5 3.5 0 0 0 6.5 15z" />
			<path d="M8 18l-1 3" />
			<path d="M12 18l-1 3" />
			<path d="M16 18l-1 3" />
		</IncidentIcon>
	);
}

export function FloodWarningIcon(props: IncidentIconProps) {
	return (
		<IncidentIcon {...props}>
			<path d="M12 2.5L18 12.5H6z" />
			<path d="M12 6v2.5" />
			<path d="M12 10.5h.01" />
			<path d="M2 16c1.7 0 1.7 1.5 3.3 1.5s1.7-1.5 3.3-1.5 1.7 1.5 3.4 1.5 1.7-1.5 3.3-1.5 1.7 1.5 3.4 1.5 1.6-1.5 3.3-1.5" />
			<path d="M2 20c1.7 0 1.7 1.5 3.3 1.5s1.7-1.5 3.3-1.5 1.7 1.5 3.4 1.5 1.7-1.5 3.3-1.5 1.7 1.5 3.4 1.5 1.6-1.5 3.3-1.5" />
		</IncidentIcon>
	);
}

export function OtherIncidentIcon(props: IncidentIconProps) {
	return (
		<IncidentIcon {...props}>
			<circle cx="12" cy="12" r="10" />
			<path d="M12 7v6" />
			<path d="M12 16.5h.01" />
		</IncidentIcon>
	);
}

export const INCIDENT_CATEGORY_ICONS = {
	road_accident: RoadAccidentIcon,
	road_works: RoadWorksIcon,
	road_block: RoadBlockIcon,
	landslide: LandslideIcon,
	flood: FloodIcon,
	fire: FireIcon,
	wildfire: WildfireIcon,
	earthquake: EarthquakeIcon,
	weather: WeatherIcon,
	medical: MedicalIcon,
	rescue: RescueIcon,
	hazmat: HazmatIcon,
	rain_warning: RainWarningIcon,
	flood_warning: FloodWarningIcon,
	other: OtherIncidentIcon,
} satisfies Record<
	keyof typeof INCIDENT_CATEGORY_LABELS,
	ComponentType<IncidentIconProps>
>;
