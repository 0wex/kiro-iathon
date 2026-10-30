import type {
	CitizenReport,
	GeoPoint,
} from "@iathon-kiro/business/citizen-reports/index";
import { Alert, AlertDescription } from "@iathon-kiro/ui/components/alert";
import { Badge } from "@iathon-kiro/ui/components/badge";
import {
	type MapRef,
	MapView,
	Marker,
	NavigationControl,
} from "@iathon-kiro/ui/components/map-view";
import { Skeleton } from "@iathon-kiro/ui/components/skeleton";
import { cn } from "@iathon-kiro/ui/lib/utils";
import { useEffect, useRef, useState } from "react";

import {
	CITIZEN_REPORT_FOCUS_DURATION_MS,
	CITIZEN_REPORT_FOCUS_ZOOM_LEVEL,
	CITIZEN_REPORT_HAZARD_LABELS,
	CITIZEN_REPORT_PRIORITY_LEVELS,
	PIURA_INITIAL_VIEW_STATE,
} from "@/constants";
import { m } from "@/paraglide/messages";

export interface ReportMapProps {
	reports: CitizenReport[];
	selectedReportId: string | undefined;
	onSelectReport: (reportId: string) => void;
	isPickingLocation: boolean;
	pickedLocation: GeoPoint | null;
	onPickLocation: (location: GeoPoint) => void;
}

export function ReportMap({
	reports,
	selectedReportId,
	onSelectReport,
	isPickingLocation,
	pickedLocation,
	onPickLocation,
}: ReportMapProps) {
	const mapRef = useRef<MapRef>(null);
	const [isLoaded, setIsLoaded] = useState(false);
	const [hasError, setHasError] = useState(false);
	const selectedReport = reports.find(
		(report) => report.id === selectedReportId,
	);

	useEffect(() => {
		if (!isLoaded || !selectedReport || isPickingLocation) return;
		mapRef.current?.easeTo({
			center: [selectedReport.location.lon, selectedReport.location.lat],
			zoom: Math.max(
				mapRef.current.getZoom(),
				CITIZEN_REPORT_FOCUS_ZOOM_LEVEL,
			),
			duration: CITIZEN_REPORT_FOCUS_DURATION_MS,
		});
	}, [isLoaded, selectedReport, isPickingLocation]);

	return (
		<section
			aria-label={m.citizen_reports_map_label()}
			className="flex flex-col gap-2"
		>
			<div className="relative h-72 min-w-0 overflow-hidden rounded-lg border bg-muted md:h-96">
				<MapView
					ref={mapRef}
					initialViewState={PIURA_INITIAL_VIEW_STATE}
					cursor={isPickingLocation ? "crosshair" : "grab"}
					onLoad={() => setIsLoaded(true)}
					onError={() => setHasError(true)}
					onClick={(event) => {
						if (isPickingLocation)
							onPickLocation({ lon: event.lngLat.lng, lat: event.lngLat.lat });
					}}
				>
					<NavigationControl position="top-right" />
					{reports.map((report) => {
						const priorityLevel = CITIZEN_REPORT_PRIORITY_LEVELS[report.priority];
						const isSelected = report.id === selectedReportId;
						return (
							<Marker
								key={report.id}
								longitude={report.location.lon}
								latitude={report.location.lat}
								style={{ zIndex: isSelected ? 1 : 0 }}
							>
								<button
									type="button"
									aria-label={m.citizen_reports_marker_label({
										hazard: CITIZEN_REPORT_HAZARD_LABELS[report.hazardKind](),
										priority: priorityLevel.label(),
									})}
									aria-pressed={isSelected}
									tabIndex={isPickingLocation ? -1 : undefined}
									onClick={(event) => {
										event.stopPropagation();
										onSelectReport(report.id);
									}}
									className={cn(
										"block size-4 cursor-pointer rounded-full border-2 border-background outline-none focus-visible:ring-2 focus-visible:ring-ring",
										priorityLevel.markerClassName,
										isSelected && "size-6 ring-2 ring-foreground",
										isPickingLocation && "pointer-events-none",
									)}
								/>
							</Marker>
						);
					})}
					{pickedLocation && (
						<Marker
							longitude={pickedLocation.lon}
							latitude={pickedLocation.lat}
						>
							<span
								role="img"
								aria-label={m.citizen_reports_picked_location_marker()}
								className="block size-5 rounded-full border-2 border-background bg-primary ring-2 ring-primary"
							/>
						</Marker>
					)}
				</MapView>
				{!isLoaded && !hasError && (
					<output
						aria-label={m.citizen_reports_map_loading()}
						className="pointer-events-none absolute inset-0 p-4"
					>
						<Skeleton className="size-full" />
					</output>
				)}
				{hasError && (
					<Alert className="absolute top-3 left-3 max-w-xs">
						<AlertDescription>{m.citizen_reports_map_error()}</AlertDescription>
					</Alert>
				)}
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<span className="type-label text-muted-foreground">
					{m.citizen_reports_legend_label()}
				</span>
				{Object.values(CITIZEN_REPORT_PRIORITY_LEVELS).map((priorityLevel) => (
					<Badge key={priorityLevel.variant} variant={priorityLevel.variant}>
						{priorityLevel.label()}
					</Badge>
				))}
			</div>
		</section>
	);
}
