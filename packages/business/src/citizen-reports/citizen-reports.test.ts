import { describe, expect, it } from "vitest";

import {
	type CitizenReport,
	classifyByRules,
	compareReportsByPriority,
	contingencyPlanContentSchema,
	createCitizenReportInputSchema,
	HAZARD_KINDS,
	PHOTO_MAX_BYTES,
	reportsNear,
	templatePlanFor,
} from "./index";

const PIURA_CENTER = { lon: -80.6328, lat: -5.1945 };

function reportAt(overrides: Partial<CitizenReport>): CitizenReport {
	return {
		id: "report-1",
		description: "Calle inundada frente al mercado",
		location: PIURA_CENTER,
		photoUrl: null,
		hazardKind: "inundacion",
		priority: "media",
		isExample: false,
		createdAt: new Date("2026-02-10T10:00:00Z"),
		plan: null,
		...overrides,
	};
}

describe("createCitizenReportInputSchema", () => {
	it("accepts a description and a location inside Piura", () => {
		const parsed = createCitizenReportInputSchema.safeParse({
			description: "Desborde del dren Sullana",
			location: PIURA_CENTER,
		});
		expect(parsed.success).toBe(true);
	});

	it("rejects descriptions shorter than 10 or longer than 600 characters", () => {
		for (const description of ["corto", "a".repeat(601)]) {
			const parsed = createCitizenReportInputSchema.safeParse({
				description,
				location: PIURA_CENTER,
			});
			expect(parsed.success).toBe(false);
		}
	});

	it("rejects a location outside the Piura region", () => {
		const parsed = createCitizenReportInputSchema.safeParse({
			description: "Huayco en la carretera central",
			location: { lon: -76.9, lat: -11.9 },
		});
		expect(parsed.success).toBe(false);
	});

	it("rejects photos that are not JPEG, PNG or WebP, or are too large", () => {
		const tooLarge = Buffer.alloc(PHOTO_MAX_BYTES + 1).toString("base64");
		for (const photo of [
			{ mediaType: "image/gif", base64: "R0lGOD" },
			{ mediaType: "image/jpeg", base64: tooLarge },
		]) {
			const parsed = createCitizenReportInputSchema.safeParse({
				description: "Desborde del dren Sullana",
				location: PIURA_CENTER,
				photo,
			});
			expect(parsed.success).toBe(false);
		}
	});
});

describe("classifyByRules", () => {
	it("detects the hazard kind from keywords, ignoring accents", () => {
		expect(
			classifyByRules(
				{ description: "Huaico bajó por la quebrada", location: PIURA_CENTER },
				[],
			).hazardKind,
		).toBe("huayco");
		expect(
			classifyByRules(
				{ description: "El dren está colmatado", location: PIURA_CENTER },
				[],
			).hazardKind,
		).toBe("colapso-drenaje");
		expect(
			classifyByRules(
				{
					description: "Erosión en la defensa ribereña",
					location: PIURA_CENTER,
				},
				[],
			).hazardKind,
		).toBe("erosion-defensa");
		expect(
			classifyByRules(
				{ description: "Derrumbe de talud en la vía", location: PIURA_CENTER },
				[],
			).hazardKind,
		).toBe("deslizamiento");
		expect(
			classifyByRules(
				{ description: "Aniego en la avenida Grau", location: PIURA_CENTER },
				[],
			).hazardKind,
		).toBe("inundacion");
		expect(
			classifyByRules(
				{ description: "Poste caído en la esquina", location: PIURA_CENTER },
				[],
			).hazardKind,
		).toBe("otro");
	});

	it("marks reports with people at risk as critica", () => {
		expect(
			classifyByRules(
				{
					description: "Aniego con familias atrapadas en sus casas",
					location: PIURA_CENTER,
				},
				[],
			).priority,
		).toBe("critica");
	});

	it("raises the priority one level when a same-hazard report lies within 500 m", () => {
		const grauReport = {
			description: "Aniego en la avenida Grau",
			location: PIURA_CENTER,
		};
		const nearby = reportAt({ location: { lon: -80.6338, lat: -5.1945 } });
		const far = reportAt({ location: { lon: -80.7, lat: -5.1945 } });
		expect(classifyByRules(grauReport, [far]).priority).toBe("media");
		expect(classifyByRules(grauReport, [nearby]).priority).toBe("alta");
	});
});

describe("compareReportsByPriority", () => {
	it("orders by priority first and newest second", () => {
		const older = reportAt({
			id: "older-critica",
			priority: "critica",
			createdAt: new Date("2026-02-10T08:00:00Z"),
		});
		const newer = reportAt({
			id: "newer-critica",
			priority: "critica",
			createdAt: new Date("2026-02-10T09:00:00Z"),
		});
		const low = reportAt({ id: "baja", priority: "baja" });
		expect(
			[low, older, newer].sort(compareReportsByPriority).map(({ id }) => id),
		).toEqual(["newer-critica", "older-critica", "baja"]);
	});
});

describe("reportsNear", () => {
	it("keeps reports within the radius and excludes the report itself", () => {
		const center = reportAt({ id: "center" });
		const close = reportAt({
			id: "close",
			location: { lon: -80.64, lat: -5.1945 },
		});
		const far = reportAt({ id: "far", location: { lon: -80.0, lat: -5.1945 } });
		expect(
			reportsNear(center, [center, close, far], 2000).map(({ id }) => id),
		).toEqual(["close"]);
	});
});

describe("templatePlanFor", () => {
	it("returns a valid plan for every hazard kind", () => {
		for (const hazardKind of HAZARD_KINDS) {
			expect(
				contingencyPlanContentSchema.safeParse(templatePlanFor(hazardKind))
					.success,
			).toBe(true);
		}
	});
});
