import type { FleetVehicle } from "../lib/fleet";
import { cn } from "../lib/utils";
import { ArrowUpIcon, TruckIcon } from "./icons";
import { Marker } from "./map-view";

export interface FleetVehicleMarkerProps {
	vehicle: FleetVehicle;
	selected?: boolean;
	onSelect: (vehicleId: string) => void;
}

export function FleetVehicleMarker({
	vehicle,
	selected,
	onSelect,
}: FleetVehicleMarkerProps) {
	if (vehicle.lastLat === null || vehicle.lastLng === null) return null;
	return (
		<Marker
			latitude={vehicle.lastLat}
			longitude={vehicle.lastLng}
			rotation={vehicle.lastHeading ?? 0}
			rotationAlignment="map"
		>
			<button
				type="button"
				aria-label={`Ver ${vehicle.name}${vehicle.plate ? ` · ${vehicle.plate}` : ""}`}
				aria-pressed={selected}
				title={vehicle.name}
				onClick={(event) => {
					event.stopPropagation();
					onSelect(vehicle.id);
				}}
				className={cn(
					"relative flex size-9 items-center justify-center rounded-full border border-border bg-background text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2",
					selected && "ring-2 ring-ring",
				)}
			>
				{vehicle.lastHeading !== null && (
					<span className="pointer-events-none absolute inset-0">
						<ArrowUpIcon
							aria-hidden="true"
							className="absolute -top-3 left-1/2 size-4 -translate-x-1/2 text-primary"
						/>
					</span>
				)}
				<TruckIcon aria-hidden="true" className="size-4" />
			</button>
		</Marker>
	);
}
