import type { FleetAlert } from "../lib/fleet";
import { formatFleetDistance } from "../lib/fleet-format";
import { cn } from "../lib/utils";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./card";
import { DateTime } from "./date-time";
import { SeverityBadge } from "./severity";

export interface AlertCardProps {
	alert: FleetAlert;
	selected: boolean;
	isAcknowledging: boolean;
	onSelect: () => void;
	onAcknowledge: () => void;
}

export function AlertCard({
	alert,
	selected,
	isAcknowledging,
	onSelect,
	onAcknowledge,
}: AlertCardProps) {
	return (
		<Card className={cn(selected && "ring-2 ring-ring")}>
			<CardHeader>
				<div className="flex flex-wrap gap-2">
					<SeverityBadge severity={alert.severity} />
					{alert.status === "acknowledged" && (
						<Badge variant="secondary">Reconocida</Badge>
					)}
				</div>
				<CardTitle className="break-words">{alert.title}</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				<p className="type-body break-words">{alert.message}</p>
				<dl className="type-data grid gap-2">
					<div>
						<dt className="type-label text-muted-foreground">
							Vehículo · viaje
						</dt>
						<dd>
							{alert.vehicleName ?? "Vehículo eliminado"} ·{" "}
							{alert.tripName ?? "Viaje no disponible"}
						</dd>
					</div>
					<div>
						<dt className="type-label text-muted-foreground">
							Distancia por delante
						</dt>
						<dd>{formatFleetDistance(alert.distanceAheadM)}</dd>
					</div>
					<div>
						<dt className="type-label text-muted-foreground">
							Llegada estimada al riesgo
						</dt>
						<dd>
							{alert.etaToHazardAt ? (
								<DateTime value={alert.etaToHazardAt} />
							) : (
								"Sin estimación"
							)}
						</dd>
					</div>
				</dl>
			</CardContent>
			<CardFooter className="flex flex-wrap gap-2">
				<Button
					variant={selected ? "secondary" : "outline"}
					aria-pressed={selected}
					onClick={onSelect}
				>
					Ver en el mapa
				</Button>
				{alert.status === "open" && (
					<Button disabled={isAcknowledging} onClick={onAcknowledge}>
						{isAcknowledging ? "Reconociendo…" : "Reconocer alerta"}
					</Button>
				)}
			</CardFooter>
		</Card>
	);
}
