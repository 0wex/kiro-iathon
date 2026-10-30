import { describe, expect, it } from "vitest";

import { createCitizenReportServices } from "./services";

describe("citizen report services", () => {
	it("serves report photos from the same origin as the app", () => {
		const services = createCitizenReportServices({
			bedrockRegion: "us-east-1",
			bedrockModelId: "amazon.nova-lite-v1:0",
			photosBucket: "report-photos",
			photosRegion: "us-east-1",
		});

		expect(services.photos.publicUrl("citizen-reports/report-1.jpg")).toBe(
			"/citizen-reports/report-1.jpg",
		);
	});
});
