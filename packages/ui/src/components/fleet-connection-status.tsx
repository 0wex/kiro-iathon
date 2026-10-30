import type { FleetConnection } from "../lib/fleet";
import { Badge } from "./badge";

export interface ConnectionStatusBadgeProps {
	status: FleetConnection["status"];
}

export function ConnectionStatusBadge({ status }: ConnectionStatusBadgeProps) {
	return (
		<Badge variant={status === "error" ? "destructive" : "secondary"}>
			{status === "error" ? "Error de conexión" : "Conectado"}
		</Badge>
	);
}
