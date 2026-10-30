import { GEOTAB_DEFAULT_SERVER } from "@hack-the-andes-project/business/providers/constants";
import type { GpsProviderKind } from "@hack-the-andes-project/business/providers/types";

import type { FleetAlert, FleetTrip, FleetVehicle } from "./fleet";

export const EMPTY_FLEET_VEHICLES: FleetVehicle[] = [];
export const EMPTY_FLEET_TRIPS: FleetTrip[] = [];
export const EMPTY_FLEET_ALERTS: FleetAlert[] = [];
export const TRIP_STATUS_LABELS = {
	active: "En curso",
	completed: "Completado",
	cancelled: "Cancelado",
};

export interface CredentialField {
	name: string;
	label: string;
	type: "text" | "password";
	autoComplete: string;
	defaultValue?: string;
}

export const CREDENTIAL_FIELDS_BY_PROVIDER: Record<
	GpsProviderKind,
	CredentialField[]
> = {
	geotab: [
		{
			name: "server",
			label: "Servidor",
			type: "text",
			autoComplete: "off",
			defaultValue: GEOTAB_DEFAULT_SERVER,
		},
		{
			name: "database",
			label: "Base de datos",
			type: "text",
			autoComplete: "off",
		},
		{
			name: "userName",
			label: "Usuario",
			type: "text",
			autoComplete: "username",
		},
		{
			name: "password",
			label: "Contraseña",
			type: "password",
			autoComplete: "current-password",
		},
	],
	samsara: [
		{
			name: "apiToken",
			label: "Token de API",
			type: "password",
			autoComplete: "off",
		},
	],
	demo: [],
};
