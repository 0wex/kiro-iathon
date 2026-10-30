import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@hack-the-andes-project/ui/components/alert";
import { Badge } from "@hack-the-andes-project/ui/components/badge";
import { RouteDiagram } from "@hack-the-andes-project/ui/components/showcase/route-diagram";
import { ShowcaseSection } from "@hack-the-andes-project/ui/components/showcase/section";
import { cn } from "@hack-the-andes-project/ui/lib/utils";
import { RISK_LEVELS } from "@/constants";
import { m } from "@/paraglide/messages";

export function RiskStatesSection() {
	return (
		<ShowcaseSection
			kicker={m.ds_section_kicker()}
			id="riesgo"
			number="05"
			title={m.ds_risk_title()}
			description={m.ds_risk_description()}
		>
			<div className="grid grid-cols-2 overflow-hidden rounded-lg lg:grid-cols-4">
				{RISK_LEVELS.map((risk) => (
					<div
						key={risk.variant}
						className={cn(
							"flex min-w-0 flex-col gap-4 p-5",
							risk.fillClassName,
							risk.inkClassName,
						)}
					>
						<p className="type-label">{risk.colorName()}</p>
						<h3 className="type-heading">{risk.label()}</h3>
						<p className="text-sm">
							{m.ds_risk_recommendation({
								recommendation: risk.recommendation().toLowerCase(),
							})}
						</p>
					</div>
				))}
			</div>
			<p className="mt-4 text-muted-foreground text-xs">
				{m.ds_risk_recommendation_note()}
			</p>
			<div className="mt-10 grid gap-10 md:grid-cols-2">
				<div className="flex flex-col gap-5">
					<h3 className="type-heading">{m.ds_risk_badges_title()}</h3>
					<div className="flex flex-wrap gap-3">
						{RISK_LEVELS.map((risk) => (
							<Badge key={risk.variant} variant={risk.variant}>
								{risk.label()}
							</Badge>
						))}
					</div>
				</div>
				<div className="flex flex-col gap-5">
					<h3 className="type-heading">{m.ds_risk_markers_title()}</h3>
					<div className="flex flex-wrap gap-5">
						{RISK_LEVELS.map((risk) => (
							<div key={risk.variant} className="flex items-center gap-2">
								<span
									aria-hidden="true"
									className={cn(
										"size-3 shrink-0 rounded-full",
										risk.fillClassName,
									)}
								/>
								<span className="text-sm">{risk.label()}</span>
							</div>
						))}
					</div>
				</div>
			</div>
			<figure className="mt-10 rounded-lg border bg-card p-5">
				<figcaption className="type-label">
					{m.ds_risk_diagram_caption()}
				</figcaption>
				<RouteDiagram
					label={m.ds_route_diagram_label()}
					title={m.ds_route_diagram_title()}
				/>
				<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
					{RISK_LEVELS.map((risk) => (
						<div key={risk.variant} className="flex flex-col items-start gap-2">
							<Badge variant={risk.variant}>{risk.label()}</Badge>
							<span className="text-muted-foreground text-xs">
								{risk.colorName()}
							</span>
						</div>
					))}
				</div>
			</figure>
			<div className="mt-8 grid gap-4 md:grid-cols-2">
				<Alert variant="critical">
					<AlertTitle>{m.ds_critical_closure()}</AlertTitle>
					<AlertDescription>
						{m.ds_critical_alert_description()}
					</AlertDescription>
				</Alert>
				<Alert variant="high">
					<AlertTitle>{m.ds_high_forecast_title()}</AlertTitle>
					<AlertDescription>{m.ds_high_alert_description()}</AlertDescription>
				</Alert>
			</div>
		</ShowcaseSection>
	);
}
