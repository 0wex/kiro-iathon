import {
	METERS_PER_KM,
	SECONDS_PER_MINUTE,
} from "@hack-the-andes-project/business/constants";

import {
	FLEET_DISTANCE_FRACTION_DIGITS,
	FLEET_DURATION_FRACTION_DIGITS,
	MINUTES_PER_HOUR,
} from "../constants";

const distanceFormatter = new Intl.NumberFormat("es-PE", {
	maximumFractionDigits: FLEET_DISTANCE_FRACTION_DIGITS,
});
const minuteFormatter = new Intl.NumberFormat("es-PE", {
	maximumFractionDigits: FLEET_DURATION_FRACTION_DIGITS,
});

export function formatFleetDistance(distanceM: number) {
	return `${distanceFormatter.format(distanceM / METERS_PER_KM)} km`;
}

export function formatFleetDuration(durationS: number) {
	const totalMinutes = Math.round(Math.abs(durationS) / SECONDS_PER_MINUTE);
	const hours = Math.floor(totalMinutes / MINUTES_PER_HOUR);
	const minutes = totalMinutes % MINUTES_PER_HOUR;
	return `${durationS < 0 ? "−" : ""}${hours ? `${hours} h ` : ""}${minuteFormatter.format(minutes)} min`;
}
