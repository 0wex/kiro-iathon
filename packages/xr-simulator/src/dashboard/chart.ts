export interface ChartPoint {
	time: number;
	value: number;
}

/** SVG polyline points: time 0..duration across the width, value 0..maxValue up from the bottom. */
export function chartPolyline(
	points: ChartPoint[],
	duration: number,
	maxValue: number,
	width: number,
	height: number,
): string {
	return points
		.map((point) => {
			const x = (point.time / duration) * width;
			const y =
				maxValue > 0 ? height - (point.value / maxValue) * height : height;
			return `${Number(x.toFixed(1))},${Number(y.toFixed(1))}`;
		})
		.join(" ");
}

export function formatClock(seconds: number): string {
	const wholeSeconds = Math.round(seconds);
	return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}
