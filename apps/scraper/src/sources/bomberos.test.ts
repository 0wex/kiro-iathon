import { describe, expect, it } from "vitest";

import { parseBomberosListing, toBomberosIncident } from "./bomberos";

const ROW = (
	reportNumber: string,
	address: string,
	type: string,
	status: string,
	machines: string[],
) => `
<tr>
  <th scope="row">1</th>
  <td class="text-center align-middle border-danger"><span>${reportNumber}</span></td>
  <td class="text-center align-middle border-danger"><span>17/10/2026 12:52:46 p.m.</span></td>
  <td class="align-middle border-danger emergency-direction"><p style="padding: 0">${address}</p></td>
  <td class="align-middle border-danger"><i class="fas fa-circle mr-2" onclick='window.showResumen(${reportNumber})'></i><span>${type}</span></td>
  <td class="text-center align-middle border-danger">
    <span class="badge badge-pill badge-danger"><i class="fas fa-circle-notch fa-spin mr-2"></i><span>${status}</span></span>
  </td>
  <td class="align-middle border-danger">
    <ul style="list-style: none; padding: 0;">
      ${machines.map((machine) => `<li><i class="fas fa-bus-alt mr-2"></i><span>${machine}</span></li>`).join("")}
    </ul>
  </td>
  <td class="text-center align-middle border-danger">
    <button type="button" onclick="window.showEmergency('${reportNumber}')"><i class="fas fa-map-marked-alt"></i></button>
  </td>
</tr>`;

const PAGE = `<html><body><table><thead><tr><th>#</th></tr></thead><tbody>
${ROW("2026035450", "CL. EL GRECO ESQ BOTTGER    (-12.0969,-76.9912)  Nro.  300  - SAN BORJA", "ACCIDENTE VEHICULAR / PARTICULAR / AUTOMOVIL", "ATENDIENDO", ["M4-5", "MED-28"])}
${ROW("2026035449", "AV. CANADA    (0,0)  Nro.  3740  - SAN LUIS", "EMERGENCIA MEDICA / TIPO MEDICO / DIFICULTAD RESPIRATORIA", "CERRADO", [])}
</tbody></table></body></html>`;

describe("parseBomberosListing", () => {
	it("extracts one emergency per desktop table row", () => {
		const emergencies = parseBomberosListing(PAGE);
		expect(emergencies).toHaveLength(2);
		expect(emergencies[0]).toEqual({
			reportNumber: "2026035450",
			reportedAtText: "17/10/2026 12:52:46 p.m.",
			address:
				"CL. EL GRECO ESQ BOTTGER (-12.0969,-76.9912) Nro. 300 - SAN BORJA",
			type: "ACCIDENTE VEHICULAR / PARTICULAR / AUTOMOVIL",
			status: "ATENDIENDO",
			machines: ["M4-5", "MED-28"],
			hasMap: true,
		});
	});

	it("throws on a block page instead of returning an empty list", () => {
		expect(() =>
			parseBomberosListing("<html><title>Forbidden</title></html>"),
		).toThrow(/blocked/);
	});
});

describe("toBomberosIncident", () => {
	const [accident, medical] =
		parseBomberosListing(PAGE).map(toBomberosIncident);

	it("maps a vehicle accident being attended to a warning with a point", () => {
		expect(accident?.category).toBe("road_accident");
		expect(accident?.severity).toBe("warning");
		expect(accident?.distrito).toBe("SAN BORJA");
		expect(accident?.lat).toBe(-12.0969);
		expect(accident?.lng).toBe(-76.9912);
		expect(accident?.geometry).toEqual({
			type: "Point",
			coordinates: [-76.9912, -12.0969],
		});
		expect(accident?.occurredAt?.toISOString()).toBe(
			"2026-10-17T17:52:46.000Z",
		);
	});

	it("treats (0,0) as an unknown location", () => {
		expect(medical?.category).toBe("medical");
		expect(medical?.severity).toBe("info");
		expect(medical?.lat).toBeNull();
		expect(medical?.geometry).toBeNull();
	});
});
