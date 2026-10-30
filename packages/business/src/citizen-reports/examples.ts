import type { GeoPoint } from "./schemas";

export interface ExampleCitizenReport {
	id: string;
	description: string;
	location: GeoPoint;
	minutesAgo: number;
}

export const EXAMPLE_CITIZEN_REPORTS: ExampleCitizenReport[] = [
	{
		id: "example-av-sanchez-cerro",
		description:
			"Aniego en la Av. Sánchez Cerro a la altura de la Av. Gullman: el agua cubre toda la pista y ya entra a los negocios.",
		location: { lon: -80.642, lat: -5.188 },
		minutesAgo: 25,
	},
	{
		id: "example-dren-sullana",
		description:
			"El dren Sullana está colmatado con basura y desborda hacia las viviendas de la calle de al lado.",
		location: { lon: -80.633, lat: -5.182 },
		minutesAgo: 50,
	},
	{
		id: "example-castilla-rio-piura",
		description:
			"Erosión en la defensa ribereña del río Piura en Castilla: el bordo pierde tierra y el río sigue creciendo.",
		location: { lon: -80.625, lat: -5.196 },
		minutesAgo: 80,
	},
	{
		id: "example-catacaos",
		description:
			"Calles de Catacaos inundadas cerca de la plaza; varias familias quedaron aisladas en sus casas.",
		location: { lon: -80.675, lat: -5.265 },
		minutesAgo: 110,
	},
	{
		id: "example-veintiseis-octubre",
		description:
			"Buzón de desagüe colapsado en Veintiséis de Octubre, las aguas servidas rebalsan a la vereda.",
		location: { lon: -80.675, lat: -5.18 },
		minutesAgo: 140,
	},
	{
		id: "example-chulucanas-quebrada",
		description:
			"Huayco en la quebrada de Chulucanas: bajó lodo y piedras hasta la carretera y la vía está cerrada.",
		location: { lon: -80.162, lat: -5.092 },
		minutesAgo: 200,
	},
];
