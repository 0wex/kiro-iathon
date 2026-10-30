import { describe, expect, it } from "vitest";

import { isAlertableIncident } from "./alertable";

describe("isAlertableIncident", () => {
	it("alerts on weather and road-blocking categories at warning or critical", () => {
		expect(
			isAlertableIncident({ category: "weather", severity: "warning" }),
		).toBe(true);
		expect(
			isAlertableIncident({ category: "hazmat", severity: "critical" }),
		).toBe(true);
		expect(isAlertableIncident({ category: "weather", severity: "info" })).toBe(
			false,
		);
	});

	it("alerts on info only for landslide, road_block and flood", () => {
		expect(
			isAlertableIncident({ category: "landslide", severity: "info" }),
		).toBe(true);
		expect(
			isAlertableIncident({ category: "road_block", severity: "info" }),
		).toBe(true);
		expect(isAlertableIncident({ category: "flood", severity: "info" })).toBe(
			true,
		);
		expect(
			isAlertableIncident({ category: "road_works", severity: "info" }),
		).toBe(false);
	});

	it("never alerts on medical, rescue or other", () => {
		expect(
			isAlertableIncident({ category: "medical", severity: "critical" }),
		).toBe(false);
		expect(
			isAlertableIncident({ category: "rescue", severity: "critical" }),
		).toBe(false);
		expect(
			isAlertableIncident({ category: "other", severity: "critical" }),
		).toBe(false);
	});
});
