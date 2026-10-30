import type {
	CitizenReport,
	ContingencyPlan,
} from "@iathon-kiro/business/citizen-reports/index";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@iathon-kiro/ui/components/alert";
import { Badge } from "@iathon-kiro/ui/components/badge";
import { Button } from "@iathon-kiro/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@iathon-kiro/ui/components/card";
import { DateTime } from "@iathon-kiro/ui/components/date-time";
import { Spinner } from "@iathon-kiro/ui/components/spinner";

import {
	CITIZEN_REPORT_COORDINATE_DECIMALS,
	CITIZEN_REPORT_HAZARD_LABELS,
	CITIZEN_REPORT_PRIORITY_LEVELS,
} from "@/constants";
import { formatRouteReviewRelativeTime } from "@/lib/route-review-labels";
import { m } from "@/paraglide/messages";

export interface ReportDetailProps {
	report: CitizenReport;
	isGeneratingPlan: boolean;
	planErrorMessage: string | undefined;
	onGeneratePlan: () => void;
}

export function ReportDetail({
	report,
	isGeneratingPlan,
	planErrorMessage,
	onGeneratePlan,
}: ReportDetailProps) {
	const priorityLevel = CITIZEN_REPORT_PRIORITY_LEVELS[report.priority];
	const hazardLabel = CITIZEN_REPORT_HAZARD_LABELS[report.hazardKind]();

	return (
		<section aria-label={m.citizen_reports_detail_label()}>
		<Card>
			<CardHeader>
				<CardTitle className="type-heading">{hazardLabel}</CardTitle>
				<CardDescription className="flex flex-wrap items-center gap-2">
					<Badge variant={priorityLevel.variant}>{priorityLevel.label()}</Badge>
					{report.isExample && (
						<Badge variant="outline">{m.citizen_reports_example_tag()}</Badge>
					)}
				</CardDescription>
			</CardHeader>
			<CardContent className="flex flex-col gap-4">
				{report.photoUrl ? (
					<img
						src={report.photoUrl}
						alt={m.citizen_reports_photo_alt({ hazard: hazardLabel })}
						loading="lazy"
						decoding="async"
						className="max-h-72 w-full rounded-lg border object-cover"
					/>
				) : (
					<p className="type-data text-muted-foreground">
						{m.citizen_reports_no_photo()}
					</p>
				)}
				<p className="type-body wrap-break-word">{report.description}</p>
				<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
					<dt className="type-label text-muted-foreground">
						{m.citizen_reports_hazard_label()}
					</dt>
					<dd className="type-data">{hazardLabel}</dd>
					<dt className="type-label text-muted-foreground">
						{m.citizen_reports_priority_label()}
					</dt>
					<dd className="type-data">{priorityLevel.label()}</dd>
					<dt className="type-label text-muted-foreground">
						{m.citizen_reports_reported_label()}
					</dt>
					<dd className="flex flex-wrap gap-x-2">
						<DateTime value={report.createdAt} />
						<span className="type-data text-muted-foreground">
							{formatRouteReviewRelativeTime(report.createdAt)}
						</span>
					</dd>
					<dt className="type-label text-muted-foreground">
						{m.citizen_reports_location_label()}
					</dt>
					<dd className="type-data">
						{report.location.lat.toFixed(CITIZEN_REPORT_COORDINATE_DECIMALS)},{" "}
						{report.location.lon.toFixed(CITIZEN_REPORT_COORDINATE_DECIMALS)}
					</dd>
				</dl>
			</CardContent>
			<CardFooter className="flex flex-col items-stretch gap-4 border-t">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h3 className="type-heading">{m.citizen_reports_plan_title()}</h3>
					<Button
						variant={report.plan ? "outline" : "default"}
						disabled={isGeneratingPlan}
						onClick={onGeneratePlan}
						className="min-h-11"
					>
						{isGeneratingPlan && <Spinner data-icon="inline-start" />}
						{report.plan
							? m.citizen_reports_plan_regenerate()
							: m.citizen_reports_plan_generate()}
					</Button>
				</div>
				{isGeneratingPlan && (
					<Alert variant="info" role="status">
						<AlertDescription>
							{m.citizen_reports_plan_generating()}
						</AlertDescription>
					</Alert>
				)}
				{planErrorMessage && !isGeneratingPlan && (
					<Alert variant="destructive" role="alert">
						<AlertDescription>
							{m.citizen_reports_plan_error({ message: planErrorMessage })}
						</AlertDescription>
					</Alert>
				)}
				{report.plan ? (
					<ContingencyPlanView plan={report.plan} />
				) : (
					!isGeneratingPlan && (
						<p className="type-body text-muted-foreground">
							{m.citizen_reports_plan_empty()}
						</p>
					)
				)}
			</CardFooter>
		</Card>
		</section>
	);
}

interface ContingencyPlanViewProps {
	plan: ContingencyPlan;
}

function ContingencyPlanView({ plan }: ContingencyPlanViewProps) {
	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant={plan.source === "bedrock" ? "info" : "secondary"}>
					{plan.source === "bedrock"
						? m.citizen_reports_plan_source_bedrock()
						: m.citizen_reports_plan_source_template()}
				</Badge>
				<span className="type-data text-muted-foreground">
					{m.citizen_reports_plan_generated_at()}{" "}
					{formatRouteReviewRelativeTime(plan.generatedAt)}
				</span>
			</div>
			<section className="flex flex-col gap-1">
				<h4 className="type-label text-muted-foreground">
					{m.citizen_reports_plan_situation()}
				</h4>
				<p className="type-body">{plan.situation}</p>
			</section>
			<section className="flex flex-col gap-1">
				<h4 className="type-label text-muted-foreground">
					{m.citizen_reports_plan_actions()}
				</h4>
				<ol className="type-body flex list-decimal flex-col gap-1 pl-5">
					{plan.actions.map((action) => (
						<li key={action}>{action}</li>
					))}
				</ol>
			</section>
			<section className="flex flex-col gap-1">
				<h4 className="type-label text-muted-foreground">
					{m.citizen_reports_plan_resources()}
				</h4>
				<ul className="type-body flex list-disc flex-col gap-1 pl-5">
					{plan.resources.map((resource) => (
						<li key={resource}>{resource}</li>
					))}
				</ul>
			</section>
			<section className="flex flex-col gap-1">
				<h4 className="type-label text-muted-foreground">
					{m.citizen_reports_plan_responsibles()}
				</h4>
				<ul className="type-body flex list-disc flex-col gap-1 pl-5">
					{plan.responsibles.map((responsible) => (
						<li key={responsible}>{responsible}</li>
					))}
				</ul>
			</section>
			<Alert variant="moderate">
				<AlertTitle>{m.citizen_reports_plan_population_message()}</AlertTitle>
				<AlertDescription>{plan.populationMessage}</AlertDescription>
			</Alert>
			<p className="type-data text-muted-foreground">
				{m.citizen_reports_plan_disclaimer()}
			</p>
		</div>
	);
}
