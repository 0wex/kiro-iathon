import type { ContingencyPlanContent, HazardKind } from "./schemas";

const SHARED_RESPONSIBLES = [
	"Brigada vecinal",
	"Municipalidad distrital",
	"COER Piura",
];

const TEMPLATE_PLANS: Record<HazardKind, ContingencyPlanContent> = {
	inundacion: {
		situation:
			"Aniego o inundación reportada por vecinos. Puede afectar viviendas, tránsito y servicios básicos si la lluvia continúa.",
		actions: [
			"Señalizar y cerrar el paso vehicular en la zona inundada.",
			"Verificar si hay viviendas con agua dentro y personas vulnerables.",
			"Solicitar motobombas o cisterna de succión a la municipalidad.",
			"Despejar sumideros y drenes cercanos para dar salida al agua.",
		],
		resources: ["Motobomba", "Conos y cinta de señalización", "Sacos de arena"],
		responsibles: SHARED_RESPONSIBLES,
		populationMessage:
			"Evite cruzar calles inundadas y desconecte la energía si el agua entra a su vivienda. Siga las indicaciones de las autoridades.",
	},
	huayco: {
		situation:
			"Huayco reportado en la zona. Riesgo alto para viviendas cercanas al cauce y para la vía.",
		actions: [
			"Alejar a las personas del cauce de la quebrada de inmediato.",
			"Cerrar la vía afectada y desviar el tránsito.",
			"Evaluar viviendas afectadas y registrar familias damnificadas.",
			"Coordinar maquinaria para limpiar el lodo cuando el flujo se detenga.",
		],
		resources: ["Maquinaria pesada", "Kits de ayuda humanitaria", "Linternas"],
		responsibles: [...SHARED_RESPONSIBLES, "Bomberos"],
		populationMessage:
			"Aléjese de quebradas y cauces secos. No regrese a la zona hasta que las autoridades lo indiquen.",
	},
	deslizamiento: {
		situation:
			"Deslizamiento o derrumbe reportado. Puede repetirse mientras el terreno siga saturado.",
		actions: [
			"Aislar el área bajo el talud y evacuar viviendas expuestas.",
			"Cerrar o restringir el paso en la vía afectada.",
			"Vigilar nuevas grietas o caída de rocas y reportarlas.",
		],
		resources: ["Cinta de señalización", "Maquinaria para remoción", "Radio"],
		responsibles: SHARED_RESPONSIBLES,
		populationMessage:
			"No permanezca al pie de taludes ni cerros con grietas. Reporte cualquier movimiento del terreno.",
	},
	"colapso-drenaje": {
		situation:
			"Dren o alcantarillado colapsado o colmatado. El agua puede desbordar hacia calles y viviendas.",
		actions: [
			"Señalizar el punto colapsado y alejar a los peatones.",
			"Solicitar a la EPS y a la municipalidad la limpieza o desatoro.",
			"Habilitar bombeo temporal si el agua sube.",
		],
		resources: ["Hidrojet o equipo de desatoro", "Motobomba", "Señalización"],
		responsibles: [...SHARED_RESPONSIBLES, "EPS Grau"],
		populationMessage:
			"No arroje basura a drenes ni buzones. Manténgase lejos de buzones abiertos o hundidos.",
	},
	"erosion-defensa": {
		situation:
			"Erosión o daño en la defensa ribereña. Riesgo de desborde del río hacia la zona poblada.",
		actions: [
			"Avisar al COER y a la autoridad del agua para monitorear el caudal.",
			"Reforzar el tramo dañado con sacos de arena o enrocado temporal.",
			"Preparar la ruta de evacuación hacia la zona segura más cercana.",
			"Mantener vigilancia continua del tramo durante la noche.",
		],
		resources: ["Sacos de arena", "Material de enrocado", "Linternas y radios"],
		responsibles: [...SHARED_RESPONSIBLES, "Autoridad Nacional del Agua"],
		populationMessage:
			"Identifique su ruta de evacuación y tenga lista su mochila de emergencia. Siga los avisos sobre el caudal del río.",
	},
	otro: {
		situation:
			"Punto crítico reportado por vecinos que requiere evaluación en campo.",
		actions: [
			"Enviar a la brigada a evaluar el punto y confirmar el riesgo.",
			"Señalizar la zona si hay peligro para peatones o vehículos.",
			"Registrar el resultado de la evaluación en el tablero.",
		],
		resources: ["Señalización", "Equipo de comunicación"],
		responsibles: SHARED_RESPONSIBLES,
		populationMessage:
			"Manténgase alejado del punto reportado hasta que la brigada lo evalúe.",
	},
};

export function templatePlanFor(hazardKind: HazardKind) {
	return TEMPLATE_PLANS[hazardKind];
}
