import { createTypeSafeAi } from "@ai-sdk/typesafe-ai";
import type {
	IncidentCategory,
	IncidentSeverity,
	RoadStatus,
} from "@hack-the-andes-project/db/schema/scraper";
import { experimental_decide } from "ai";

import {
	JEV_MODEL,
	NEWS_IN_PERU_THRESHOLD,
	NEWS_RELEVANCE_THRESHOLD,
	NEWS_SEVERITY_CRITICAL_SCORE,
	NEWS_SEVERITY_WARNING_SCORE,
} from "../constants";

export const PERU_REGION_CRITERIA = {
	AMAZONAS: null,
	ANCASH: null,
	APURIMAC: null,
	AREQUIPA: null,
	AYACUCHO: null,
	CAJAMARCA: null,
	CALLAO: null,
	CUSCO: null,
	HUANCAVELICA: null,
	HUANUCO: null,
	ICA: null,
	JUNIN: null,
	"LA LIBERTAD": null,
	LAMBAYEQUE: null,
	LIMA: null,
	LORETO: null,
	"MADRE DE DIOS": null,
	MOQUEGUA: null,
	PASCO: null,
	PIURA: null,
	PUNO: null,
	"SAN MARTIN": null,
	TACNA: null,
	TUMBES: null,
	UCAYALI: null,
} as const;
type PeruRegion = keyof typeof PERU_REGION_CRITERIA;

const CATEGORY_CRITERIA: Record<IncidentCategory | "no_aplica", string> = {
	road_accident:
		"Accidente de tránsito: choque, despiste, volcadura, atropello en una vía",
	road_block:
		"Bloqueo de vía por personas: paro, protesta, huelga, toma de carretera",
	road_works: "Obras, mantenimiento o cierre programado de una vía o puente",
	landslide: "Huaico, derrumbe, deslizamiento o caída de rocas",
	flood: "Inundación, desborde de río o lluvias que anegan zonas o vías",
	fire: "Incendio urbano, en vehículo, almacén, mercado o vivienda",
	wildfire: "Incendio forestal o de pastizales",
	earthquake: "Sismo o temblor",
	weather:
		"Clima adverso: lluvias intensas, nevada, helada, neblina, vientos fuertes, oleaje",
	medical: "Emergencia médica o sanitaria sin impacto en vías",
	rescue: "Rescate de personas (montaña, río, mar, derrumbe)",
	hazmat: "Derrame, fuga de gas o químicos, explosión, material peligroso",
	rain_warning: "Aviso o pronóstico de lluvias intensas (no ha ocurrido aún)",
	flood_warning:
		"Aviso de crecida de ríos o activación de quebradas (no ha ocurrido aún)",
	other:
		"Otro hecho que afecta el transporte terrestre (asalto en carretera, operativo, cierre de frontera, falta de combustible)",
	no_aplica: "La noticia no trata de ningún hecho que afecte el transporte",
};

type RegionChoice = PeruRegion | "VARIAS" | "DESCONOCIDA";

const REGION_CRITERIA: Record<RegionChoice, string | null> = {
	...PERU_REGION_CRITERIA,
	VARIAS: "Varios departamentos a la vez",
	DESCONOCIDA: "No se menciona o no ocurre en el Perú",
};

const SEVERITY_LEVELS = [
	"Sin impacto en el transporte terrestre",
	"Impacto menor o muy localizado (una calle, sin interrupción)",
	"Impacto moderado: demoras, desvíos o restricción parcial de una vía",
	"Impacto severo: vía cerrada, pasajeros varados, heridos o fallecidos",
	"Impacto crítico: emergencia regional, múltiples vías o riesgo continuo",
];

const QUESTIONS = {
	relevante: {
		type: "boolean",
		instructions:
			"¿Esta noticia describe un hecho o condición que puede afectar el transporte terrestre interprovincial en el Perú (buses de pasajeros o de carga): accidentes de tránsito, bloqueos, paros, huaicos, derrumbes, inundaciones, incendios, cierres de vía, clima adverso, sismos o inseguridad en carreteras?",
		criteria: {
			true: "Sí, un operador de buses interprovinciales querría saberlo para planificar rutas",
			false:
				"No: deportes, espectáculos, política general, economía, internacional sin efecto en Perú, opinión",
		},
	},
	enPeru: {
		type: "boolean",
		instructions: "¿El hecho ocurre dentro del territorio peruano?",
	},
	vigente: {
		type: "boolean",
		instructions:
			"¿La situación está ocurriendo ahora, es reciente (últimas 48 horas) o es inminente? Responde no si es un balance, aniversario, opinión o un hecho ya resuelto hace días.",
	},
	mencionaVia: {
		type: "boolean",
		instructions:
			"¿Se menciona explícitamente una carretera, autopista, vía, puente, túnel, peaje o tramo (por ejemplo Panamericana, Carretera Central, PE-3S, Km 45, Vía de Evitamiento)?",
	},
	viaBloqueada: {
		type: "boolean",
		instructions:
			"¿Alguna vía está interrumpida o intransitable (bloqueo total, derrumbe sobre la pista, puente colapsado, cierre)?",
	},
	esProtesta: {
		type: "boolean",
		instructions:
			"¿Se trata de una protesta, paro, huelga, marcha o bloqueo realizado por personas?",
	},
	afectaPersonas: {
		type: "boolean",
		instructions:
			"¿Hay pasajeros o conductores varados, heridos o fallecidos en el hecho?",
	},
	categoria: {
		type: "choice",
		instructions:
			"¿Qué tipo de hecho describe la noticia? Elige la categoría principal.",
		criteria: CATEGORY_CRITERIA,
	},
	severidad: {
		type: "score",
		instructions:
			"¿Qué tan grave es el impacto de este hecho para el transporte terrestre de pasajeros y carga?",
		criteria: SEVERITY_LEVELS,
	},
	horizonte: {
		type: "choice",
		instructions: "¿Cuándo ocurre el hecho respecto al momento de la noticia?",
		criteria: {
			ocurriendo: "Está ocurriendo en este momento o acaba de ocurrir",
			inminente: "Está anunciado o pronosticado para las próximas horas o días",
			pasado: "Ya ocurrió y la situación está resuelta, o es un recuento",
		},
	},
	alcance: {
		type: "choice",
		instructions: "¿Cuál es el alcance geográfico del hecho?",
		criteria: {
			local: "Un punto, calle, distrito o tramo concreto",
			regional: "Una provincia, región o varias vías de una zona",
			nacional: "Varias regiones del país o todo el Perú",
		},
	},
	region: {
		type: "choice",
		instructions:
			"¿En qué departamento del Perú ocurre el hecho? Elige 'VARIAS' si abarca varios y 'DESCONOCIDA' si no se puede saber o no es en Perú.",
		criteria: REGION_CRITERIA,
	},
} as const;

export interface NewsClassificationInput {
	title: string;
	excerpt: string | null;
	section: string | null;
	publishedAt: Date | null;
}

export interface NewsClassification {
	relevant: boolean;
	relevance: number;
	category: IncidentCategory | null;
	severity: IncidentSeverity | null;
	region: string | null;
	status: string;
	answers: Record<string, unknown>;
	confidence: unknown;
	model: string;
}

export async function classifyNews(
	apiKey: string,
	input: NewsClassificationInput,
): Promise<NewsClassification> {
	const typeSafe = createTypeSafeAi({ apiKey });
	const result = await experimental_decide({
		model: typeSafe.decisionModel(JEV_MODEL),
		state: {
			titulo: input.title,
			resumen: input.excerpt ?? "",
			seccion: input.section ?? "",
			publicadoEn: input.publishedAt?.toISOString() ?? "",
		},
		questions: QUESTIONS,
	});
	const { answers } = result;
	const relevance = answers.relevante.probability;
	const relevant =
		relevance >= NEWS_RELEVANCE_THRESHOLD &&
		answers.enPeru.probability >= NEWS_IN_PERU_THRESHOLD &&
		answers.categoria.choice !== "no_aplica";
	const chosenRegion = answers.region.choice;
	return {
		relevant,
		relevance,
		category:
			answers.categoria.choice === "no_aplica"
				? null
				: answers.categoria.choice,
		severity: !relevant
			? null
			: answers.severidad.score >= NEWS_SEVERITY_CRITICAL_SCORE
				? "critical"
				: answers.severidad.score >= NEWS_SEVERITY_WARNING_SCORE
					? "warning"
					: "info",
		region: Object.hasOwn(PERU_REGION_CRITERIA, chosenRegion)
			? chosenRegion
			: null,
		status: answers.horizonte.choice,
		answers,
		confidence: result.providerMetadata?.typesafe?.confidence ?? null,
		model: result.response.modelId,
	};
}

const ROAD_STATUS_CRITERIA: Record<RoadStatus, string> = {
	interrumpido:
		"Vía cerrada o intransitable: vehículos o carga sobre la calzada, espera de grúa pesada, peritaje o levantamiento de cadáver en curso",
	restringido:
		"Paso parcial: un carril ocupado, tránsito alternado, demoras o maniobras de grúa todavía en curso",
	normal:
		"Tránsito normal: vehículos retirados, escena despejada, hecho menor fuera de la calzada o ya pasó demasiado tiempo para que siga afectando",
};

const ACCIDENT_QUESTIONS = {
	estadoVia: {
		type: "choice",
		instructions:
			"Según el reporte del accidente de tránsito y las horas transcurridas desde que ocurrió, ¿cómo está ahora mismo la vía en ese punto para buses y camiones interprovinciales?",
		criteria: ROAD_STATUS_CRITERIA,
	},
} as const;

export interface AccidentRoadStatusInput {
	accidentClass: string;
	narrative: string | null;
	address: string | null;
	location: string;
	deaths: number | null;
	injured: number | null;
	vehicles: number | null;
	reportedBy: string | null;
	hoursSinceAccident: number;
}

export interface AccidentRoadStatus {
	roadStatus: RoadStatus;
	probabilities: Partial<Record<RoadStatus, number>> | null;
	confidence: unknown;
	model: string;
}

export async function classifyAccidentRoadStatus(
	apiKey: string,
	input: AccidentRoadStatusInput,
): Promise<AccidentRoadStatus> {
	const typeSafe = createTypeSafeAi({ apiKey });
	const result = await experimental_decide({
		model: typeSafe.decisionModel(JEV_MODEL),
		state: {
			clase: input.accidentClass,
			narrativa: input.narrative ?? "",
			direccion: input.address ?? "",
			ubicacion: input.location,
			fallecidos: input.deaths,
			lesionados: input.injured,
			vehiculos: input.vehicles,
			reportadoPor: input.reportedBy ?? "",
			horasDesdeElAccidente: input.hoursSinceAccident,
		},
		questions: ACCIDENT_QUESTIONS,
	});
	return {
		roadStatus: result.answers.estadoVia.choice,
		probabilities: result.answers.estadoVia.probabilities ?? null,
		confidence: result.providerMetadata?.typesafe?.confidence ?? null,
		model: result.response.modelId,
	};
}
