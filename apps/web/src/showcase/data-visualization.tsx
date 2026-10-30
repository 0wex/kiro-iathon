import {
	Alert,
	AlertDescription,
} from "@hack-the-andes-project/ui/components/alert";
import { Badge } from "@hack-the-andes-project/ui/components/badge";
import { Button } from "@hack-the-andes-project/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@hack-the-andes-project/ui/components/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartLegend,
	ChartLegendContent,
	ChartTooltip,
	ChartTooltipContent,
} from "@hack-the-andes-project/ui/components/chart";
import {
	Map as MapCanvas,
	MapControls,
	MapMarker,
	MapPopup,
	MapRoute,
	MarkerContent,
	MarkerTooltip,
} from "@hack-the-andes-project/ui/components/map";
import { ShowcaseSection } from "@hack-the-andes-project/ui/components/showcase/section";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@hack-the-andes-project/ui/components/table";
import { useTokenColors } from "@hack-the-andes-project/ui/hooks/use-token-colors";
import { type ComponentRef, useEffect, useId, useRef, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	LabelList,
	Line,
	LineChart,
	XAxis,
	YAxis,
} from "recharts";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";
import {
	VIZ_CHART_AXIS_WIDTH_PX,
	VIZ_CHART_DOT_RADIUS_PX,
	VIZ_CHART_HEIGHT_PX,
	VIZ_CHART_LINE_WIDTH_PX,
	VIZ_CHART_MARGIN_PX,
	VIZ_CHART_TICK_MARGIN_PX,
	VIZ_HAZARDS,
	VIZ_MAP_BOUNDS,
	VIZ_MAP_HEIGHT_PX,
	VIZ_MAP_MAX_ZOOM,
	VIZ_MAP_MIN_ZOOM,
	VIZ_MAP_PADDING_PX,
	VIZ_PRECIPITATION_SERIES,
	VIZ_RISK_LEVELS,
	VIZ_RISK_SERIES,
	VIZ_ROUTE_OPACITY,
	VIZ_ROUTE_SEGMENTS,
	VIZ_ROUTE_WIDTH_PX,
	VIZ_STATIONS,
} from "./data-visualization-data";

export function DataVisualizationSection() {
	const sectionId = useId();
	const routeColors = useTokenColors(
		VIZ_RISK_LEVELS.map((risk) => `--risk-${risk.key}`),
	);
	const [mapInstance, setMapInstance] = useState<ComponentRef<
		typeof MapCanvas
	> | null>(null);
	const [mapStatus, setMapStatus] = useState<"loading" | "ready" | "error">(
		"loading",
	);
	const [mapAttempt, setMapAttempt] = useState(0);
	const [selectedHazardId, setSelectedHazardId] = useState<string | null>(null);
	const activeMarkerRef = useRef<HTMLElement | null>(null);

	useEffect(() => {
		if (!mapInstance) return;
		const handleLoad = () =>
			setMapStatus((status) => (status === "error" ? status : "ready"));
		const handleError = () => setMapStatus("error");
		mapInstance.on("load", handleLoad);
		mapInstance.on("error", handleError);
		if (mapInstance.loaded()) handleLoad();
		return () => {
			mapInstance.off("load", handleLoad);
			mapInstance.off("error", handleError);
		};
	}, [mapInstance]);

	const closeHazardDetails = () => {
		setSelectedHazardId(null);
		activeMarkerRef.current?.focus();
	};
	const riskChartConfig: ChartConfig = Object.fromEntries(
		VIZ_RISK_LEVELS.map((risk) => [
			risk.key,
			{ label: risk.label(), color: `var(--risk-${risk.key})` },
		]),
	);
	const precipitationChartConfig: ChartConfig = Object.fromEntries(
		VIZ_STATIONS.map((station) => [
			station.key,
			{ label: station.label, color: station.color },
		]),
	);
	const riskSeries = VIZ_RISK_SERIES.map((entry) => ({
		...entry,
		total: entry.low + entry.moderate + entry.high + entry.critical,
		horizon:
			entry.hours === 0
				? m.horizon_now()
				: m.horizon_hours({ hours: entry.hours }),
	}));
	const precipitationSeries = VIZ_PRECIPITATION_SERIES.map((entry) => ({
		...entry,
		horizon:
			entry.hours === 0
				? m.horizon_now()
				: m.horizon_hours({ hours: entry.hours }),
	}));
	const hazardDetails = VIZ_HAZARDS.map((hazard) => ({
		...hazard,
		details: (
			<dl className="grid grid-cols-[auto_1fr] items-start gap-x-3 gap-y-2 text-xs">
				<dt className="text-muted-foreground">{m.ds_risk_label()}</dt>
				<dd>
					<Badge variant={hazard.risk.key}>{hazard.risk.label()}</Badge>
				</dd>
				<dt className="text-muted-foreground">{m.ds_viz_source()}</dt>
				<dd>{hazard.source}</dd>
				<dt className="text-muted-foreground">{m.ds_horizon_label()}</dt>
				<dd className="type-data">
					{hazard.horizonHours === 0
						? m.horizon_now()
						: m.horizon_hours({ hours: hazard.horizonHours })}
				</dd>
				<dt className="text-muted-foreground">{m.ds_recommendation_label()}</dt>
				<dd>{hazard.risk.recommendation()}</dd>
			</dl>
		),
	}));
	const selectedHazard = hazardDetails.find(
		(hazard) => hazard.id === selectedHazardId,
	);

	return (
		<ShowcaseSection
			id="datos"
			number="06"
			kicker={m.ds_section_kicker()}
			title={m.ds_viz_title()}
			description={m.ds_viz_description()}
		>
			<div className="flex min-w-0 flex-col gap-6">
				<Card>
					<CardHeader>
						<p className="type-label text-muted-foreground">
							{m.ds_viz_illustrative()}
						</p>
						<CardTitle>
							<h3 id={`${sectionId}-map-title`}>{m.ds_viz_map_title()}</h3>
						</CardTitle>
						<CardDescription>{m.ds_viz_map_description()}</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-3">
						<div
							className="relative overflow-hidden rounded-lg border border-border"
							style={{ height: VIZ_MAP_HEIGHT_PX }}
						>
							<MapCanvas
								key={`${getLocale()}-${mapAttempt}`}
								ref={setMapInstance}
								bounds={VIZ_MAP_BOUNDS}
								fitBoundsOptions={{ padding: VIZ_MAP_PADDING_PX }}
								minZoom={VIZ_MAP_MIN_ZOOM}
								maxZoom={VIZ_MAP_MAX_ZOOM}
								scrollZoom={false}
								dragRotate={false}
								touchPitch={false}
								keyboard
								locale={{ "Map.Title": m.ds_viz_map_label() }}
							>
								{VIZ_ROUTE_SEGMENTS.map((segment) =>
									routeColors[`--risk-${segment.risk}`] ? (
										<MapRoute
											key={segment.id}
											coordinates={segment.coordinates}
											color={routeColors[`--risk-${segment.risk}`]}
											width={VIZ_ROUTE_WIDTH_PX}
											opacity={VIZ_ROUTE_OPACITY}
											interactive={false}
										/>
									) : null,
								)}
								{hazardDetails.map((hazard) => (
									<MapMarker
										key={hazard.id}
										longitude={hazard.longitude}
										latitude={hazard.latitude}
									>
										<MarkerContent>
											<Badge
												render={<button type="button" />}
												variant={hazard.risk.key}
												className="size-7 cursor-pointer p-0 ring-2 ring-background"
												aria-label={m.ds_viz_open_hazard({
													id: hazard.id,
													hazard: hazard.label(),
													place: hazard.place,
													risk: hazard.risk.label(),
												})}
												aria-expanded={selectedHazardId === hazard.id}
												onClick={(event) => {
													event.stopPropagation();
													activeMarkerRef.current = event.currentTarget;
													setSelectedHazardId(hazard.id);
												}}
											>
												{hazard.id}
											</Badge>
										</MarkerContent>
										<MarkerTooltip>
											{hazard.label()} · {hazard.place} · {hazard.risk.label()}
										</MarkerTooltip>
									</MapMarker>
								))}
								{selectedHazard && (
									<MapPopup
										key={selectedHazard.id}
										longitude={selectedHazard.longitude}
										latitude={selectedHazard.latitude}
										onClose={closeHazardDetails}
									>
										<div className="flex flex-col gap-3">
											<p className="type-label">
												{selectedHazard.id} · {selectedHazard.label()}
											</p>
											<p className="type-body">{selectedHazard.place}</p>
											{selectedHazard.details}
											<p className="text-muted-foreground text-xs">
												{m.ds_viz_illustrative()}
											</p>
											<Button
												variant="outline"
												size="sm"
												onClick={closeHazardDetails}
												onKeyDown={(event) => {
													if (event.key === "Escape") closeHazardDetails();
												}}
											>
												{m.ds_viz_close()}
											</Button>
										</div>
									</MapPopup>
								)}
								<MapControls />
							</MapCanvas>
						</div>
						{mapStatus === "loading" && (
							<p role="status" className="sr-only">
								{m.ds_viz_map_loading()}
							</p>
						)}
						{mapStatus === "error" && (
							<Alert>
								<AlertDescription>
									<p>{m.ds_viz_map_error()}</p>
									<Button
										variant="outline"
										size="sm"
										onClick={() => {
											setMapStatus("loading");
											setSelectedHazardId(null);
											setMapAttempt((attempt) => attempt + 1);
										}}
									>
										{m.ds_viz_retry()}
									</Button>
								</AlertDescription>
							</Alert>
						)}
						<p className="text-muted-foreground text-xs">
							{m.ds_viz_map_help()}
						</p>
						<div className="flex flex-wrap items-center gap-2">
							<span className="type-label mr-2 text-muted-foreground">
								{m.ds_viz_legend()}
							</span>
							{VIZ_RISK_LEVELS.map((risk) => (
								<Badge key={risk.key} variant={risk.key}>
									{risk.label()}
								</Badge>
							))}
						</div>
					</CardContent>
					<CardFooter className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
						{hazardDetails.map((hazard) => (
							<details key={hazard.id} className="min-w-0">
								<summary className="cursor-pointer text-sm focus-visible:outline-2 focus-visible:outline-ring">
									<span className="type-data">{hazard.id}</span> ·{" "}
									{hazard.label()}
									<span className="mt-1 block text-muted-foreground text-xs">
										{hazard.place} · {hazard.risk.label()}
									</span>
								</summary>
								<div className="pt-3">{hazard.details}</div>
							</details>
						))}
					</CardFooter>
				</Card>

				<div className="grid min-w-0 gap-6 lg:grid-cols-2">
					<Card className="min-w-0">
						<CardHeader>
							<p className="type-label text-muted-foreground">
								{m.ds_viz_illustrative()}
							</p>
							<CardTitle>
								<h3 id={`${sectionId}-risk-title`}>
									{m.ds_viz_risk_chart_title()}
								</h3>
							</CardTitle>
							<CardDescription>
								{m.ds_viz_risk_chart_description()}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ChartContainer
								config={riskChartConfig}
								className="type-data aspect-auto w-full"
								style={{ height: VIZ_CHART_HEIGHT_PX }}
								aria-labelledby={`${sectionId}-risk-title`}
							>
								<BarChart
									accessibilityLayer
									data={riskSeries}
									margin={VIZ_CHART_MARGIN_PX}
								>
									<CartesianGrid vertical={false} stroke="var(--border)" />
									<XAxis
										dataKey="horizon"
										tickLine={false}
										axisLine={false}
										tickMargin={VIZ_CHART_TICK_MARGIN_PX}
										tick={{ className: "type-data" }}
									/>
									<YAxis
										allowDecimals={false}
										tickLine={false}
										axisLine={false}
										width={VIZ_CHART_AXIS_WIDTH_PX}
										tick={{ className: "type-data" }}
									/>
									<ChartTooltip
										itemSorter={(item) =>
											VIZ_RISK_LEVELS.findIndex(
												(risk) => risk.key === item.dataKey,
											)
										}
										content={<ChartTooltipContent className="type-data" />}
									/>
									<ChartLegend
										itemSorter={(item) =>
											VIZ_RISK_LEVELS.findIndex(
												(risk) => risk.key === item.dataKey,
											)
										}
										content={
											<ChartLegendContent className="flex-wrap gap-x-4 gap-y-2" />
										}
									/>
									{VIZ_RISK_LEVELS.map((risk) => (
										<Bar
											key={risk.key}
											dataKey={risk.key}
											stackId="risk"
											fill={`var(--color-${risk.key})`}
											isAnimationActive={false}
										>
											{risk.key === "critical" && (
												<LabelList
													dataKey="total"
													position="top"
													className="type-data fill-foreground"
												/>
											)}
										</Bar>
									))}
								</BarChart>
							</ChartContainer>
						</CardContent>
						<CardFooter className="block">
							<details>
								<summary className="type-label cursor-pointer focus-visible:outline-2 focus-visible:outline-ring">
									{m.ds_viz_table()}
								</summary>
								<Table className="mt-3">
									<TableCaption>
										{m.ds_viz_risk_chart_title()} · {m.ds_viz_illustrative()}
									</TableCaption>
									<TableHeader>
										<TableRow>
											<TableHead scope="col">{m.ds_horizon_label()}</TableHead>
											{VIZ_RISK_LEVELS.map((risk) => (
												<TableHead
													key={risk.key}
													scope="col"
													className="text-right"
												>
													{risk.label()}
												</TableHead>
											))}
										</TableRow>
									</TableHeader>
									<TableBody>
										{riskSeries.map((entry) => (
											<TableRow key={entry.hours}>
												<TableHead scope="row">{entry.horizon}</TableHead>
												{VIZ_RISK_LEVELS.map((risk) => (
													<TableCell
														key={risk.key}
														className="type-data text-right"
													>
														{entry[risk.key]}
													</TableCell>
												))}
											</TableRow>
										))}
									</TableBody>
								</Table>
							</details>
						</CardFooter>
					</Card>

					<Card className="min-w-0">
						<CardHeader>
							<p className="type-label text-muted-foreground">
								{m.ds_viz_illustrative()}
							</p>
							<CardTitle>
								<h3 id={`${sectionId}-precipitation-title`}>
									{m.ds_viz_precipitation_title()}
								</h3>
							</CardTitle>
							<CardDescription>
								{m.ds_viz_precipitation_description()}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ChartContainer
								config={precipitationChartConfig}
								className="type-data aspect-auto w-full"
								style={{ height: VIZ_CHART_HEIGHT_PX }}
								aria-labelledby={`${sectionId}-precipitation-title`}
							>
								<LineChart
									accessibilityLayer
									data={precipitationSeries}
									margin={VIZ_CHART_MARGIN_PX}
								>
									<CartesianGrid vertical={false} stroke="var(--border)" />
									<XAxis
										dataKey="horizon"
										tickLine={false}
										axisLine={false}
										tickMargin={VIZ_CHART_TICK_MARGIN_PX}
										tick={{ className: "type-data" }}
									/>
									<YAxis
										allowDecimals={false}
										tickLine={false}
										axisLine={false}
										width={VIZ_CHART_AXIS_WIDTH_PX}
										tick={{ className: "type-data" }}
									/>
									<ChartTooltip
										content={
											<ChartTooltipContent
												className="type-data"
												formatter={(value, name) => (
													<>
														<span className="text-muted-foreground">
															{precipitationChartConfig[String(name)]?.label}
														</span>
														<span className="type-data ml-auto">
															{m.ds_viz_precipitation_value({
																value: String(value),
															})}
														</span>
													</>
												)}
											/>
										}
									/>
									<ChartLegend
										itemSorter={(item) =>
											VIZ_STATIONS.findIndex(
												(station) => station.key === item.dataKey,
											)
										}
										content={
											<ChartLegendContent className="flex-wrap gap-x-4 gap-y-2" />
										}
									/>
									{VIZ_STATIONS.map((station) => (
										<Line
											key={station.key}
											dataKey={station.key}
											type="linear"
											stroke={`var(--color-${station.key})`}
											strokeWidth={VIZ_CHART_LINE_WIDTH_PX}
											strokeDasharray={station.dashArray}
											dot={{
												r: VIZ_CHART_DOT_RADIUS_PX,
												fill: `var(--color-${station.key})`,
											}}
											isAnimationActive={false}
										/>
									))}
								</LineChart>
							</ChartContainer>
						</CardContent>
						<CardFooter className="block">
							<details>
								<summary className="type-label cursor-pointer focus-visible:outline-2 focus-visible:outline-ring">
									{m.ds_viz_table()}
								</summary>
								<Table className="mt-3">
									<TableCaption>
										{m.ds_viz_precipitation_title()} · {m.ds_viz_illustrative()}
									</TableCaption>
									<TableHeader>
										<TableRow>
											<TableHead scope="col">{m.ds_horizon_label()}</TableHead>
											{VIZ_STATIONS.map((station) => (
												<TableHead
													key={station.key}
													scope="col"
													className="text-right"
												>
													{station.label}
												</TableHead>
											))}
										</TableRow>
									</TableHeader>
									<TableBody>
										{precipitationSeries.map((entry) => (
											<TableRow key={entry.hours}>
												<TableHead scope="row">{entry.horizon}</TableHead>
												<TableCell className="type-data text-right">
													{entry.matucana}
												</TableCell>
												<TableCell className="type-data text-right">
													{entry.laOroya}
												</TableCell>
												<TableCell className="type-data text-right">
													{entry.jauja}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</details>
						</CardFooter>
					</Card>
				</div>
				<p className="type-body text-muted-foreground">{m.ds_viz_rules()}</p>
			</div>
		</ShowcaseSection>
	);
}
