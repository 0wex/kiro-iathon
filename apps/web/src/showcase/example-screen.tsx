import {
	Alert,
	AlertDescription,
	AlertTitle,
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
import { TopoBackground } from "@hack-the-andes-project/ui/components/contour-art";
import {
	ArrowRightIcon,
	BellIcon,
} from "@hack-the-andes-project/ui/components/showcase/icons";
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
import { useState } from "react";
import { toast } from "sonner";
import { ROUTE_EXAMPLES } from "@/constants";
import { m } from "@/paraglide/messages";

export function ExampleScreenSection() {
	const [selectedRoute, setSelectedRoute] = useState(ROUTE_EXAMPLES[0]);
	return (
		<ShowcaseSection
			kicker={m.ds_section_kicker()}
			id="panel"
			number="08"
			title={m.ds_panel_section_title()}
			description={m.ds_panel_section_description()}
		>
			<div className="relative isolate min-w-0 overflow-hidden rounded-lg border bg-background p-4 sm:p-6">
				<TopoBackground className="text-foreground/[0.06]" />
				<div className="relative flex min-w-0 flex-col gap-8">
					<div className="flex flex-wrap items-start justify-between gap-4">
						<div className="flex flex-col gap-3">
							<p className="type-label text-muted-foreground">
								{m.ds_panel_kicker()}
							</p>
							<h3 className="type-heading">{m.ds_panel_title()}</h3>
							<p className="text-muted-foreground text-sm">
								{m.ds_panel_description()}
							</p>
						</div>
						<Badge variant="outline">{m.ds_demo_data()}</Badge>
					</div>
					<div className="grid min-w-0 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
						<div className="min-w-0 rounded-lg border bg-card p-2">
							<Table className="lg:table-fixed">
								<TableCaption>{m.ds_panel_caption()}</TableCaption>
								<TableHeader>
									<TableRow>
										<TableHead className="lg:w-1/3">
											{m.ds_route_label()}
										</TableHead>
										<TableHead className="lg:w-24">
											{m.ds_risk_label()}
										</TableHead>
										<TableHead className="lg:w-28">
											{m.ds_horizon_label()}
										</TableHead>
										<TableHead>{m.ds_cause_label()}</TableHead>
										<TableHead className="lg:w-40">
											{m.ds_recommendation_label()}
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{ROUTE_EXAMPLES.map((route) => (
										<TableRow
											key={route.id}
											data-state={
												selectedRoute.id === route.id ? "selected" : undefined
											}
										>
											<TableCell>
												<Button
													variant="link"
													className="lg:h-auto lg:min-h-8 lg:w-full lg:justify-start lg:whitespace-normal lg:px-0 lg:text-left"
													onClick={() => setSelectedRoute(route)}
													aria-pressed={selectedRoute.id === route.id}
												>
													{route.name()}
												</Button>
												<p className="type-data px-2.5 text-muted-foreground lg:px-0">
													{route.id}
												</p>
											</TableCell>
											<TableCell>
												<Badge variant={route.risk}>{route.riskLabel()}</Badge>
											</TableCell>
											<TableCell>
												<span className="type-data">{route.horizon()}</span>
											</TableCell>
											<TableCell className="whitespace-normal">
												{route.cause()}
											</TableCell>
											<TableCell>{route.recommendation()}</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
						<Card>
							<CardHeader>
								<p className="type-label text-muted-foreground">
									{m.ds_selected_route()}
								</p>
								<CardTitle>{selectedRoute.name()}</CardTitle>
								<CardDescription>
									{m.ds_panel_route_horizon({
										route: selectedRoute.id,
										horizon: selectedRoute.horizon().toLowerCase(),
									})}
								</CardDescription>
							</CardHeader>
							<CardContent className="flex flex-col gap-5">
								<Badge variant={selectedRoute.risk}>
									{selectedRoute.riskLabel()}
								</Badge>
								<Alert variant={selectedRoute.risk}>
									<AlertTitle>{selectedRoute.cause()}</AlertTitle>
									<AlertDescription>
										{m.ds_panel_recommendation({
											recommendation: selectedRoute
												.recommendation()
												.toLowerCase(),
										})}
									</AlertDescription>
								</Alert>
								<p className="text-muted-foreground text-xs">
									{m.ds_panel_evidence_note()}
								</p>
							</CardContent>
							<CardFooter className="flex-wrap gap-2">
								<Button
									onClick={() =>
										toast.info(
											m.ds_panel_toast_recommendation({
												recommendation: selectedRoute
													.recommendation()
													.toLowerCase(),
											}),
											{ description: selectedRoute.name() },
										)
									}
								>
									{selectedRoute.recommendation()}
									<ArrowRightIcon data-icon="inline-end" />
								</Button>
								<Button
									variant="outline"
									onClick={() =>
										toast.success(m.ds_toast_follow_enabled(), {
											description: selectedRoute.name(),
										})
									}
								>
									<BellIcon data-icon="inline-start" />
									{m.ds_follow_route()}
								</Button>
							</CardFooter>
						</Card>
					</div>
				</div>
			</div>
		</ShowcaseSection>
	);
}
