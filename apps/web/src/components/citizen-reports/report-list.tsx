import type { CitizenReport } from "@iathon-kiro/business/citizen-reports/index";
import { Badge } from "@iathon-kiro/ui/components/badge";
import { cn } from "@iathon-kiro/ui/lib/utils";

import {
	CITIZEN_REPORT_HAZARD_LABELS,
	CITIZEN_REPORT_PRIORITY_LEVELS,
} from "@/constants";
import { formatRouteReviewRelativeTime } from "@/lib/route-review-labels";
import { m } from "@/paraglide/messages";

export interface ReportListProps {
	reports: CitizenReport[];
	selectedReportId: string | undefined;
	onSelectReport: (reportId: string) => void;
}

export function ReportList({
	reports,
	selectedReportId,
	onSelectReport,
}: ReportListProps) {
	return (
		<ol aria-label={m.citizen_reports_list_label()} className="flex flex-col gap-2">
			{reports.map((report) => {
				const priorityLevel = CITIZEN_REPORT_PRIORITY_LEVELS[report.priority];
				const isSelected = report.id === selectedReportId;
				return (
					<li key={report.id}>
						<button
							type="button"
							aria-current={isSelected ? "true" : undefined}
							onClick={() => onSelectReport(report.id)}
							className={cn(
								"flex w-full flex-col gap-2 rounded-lg border bg-card p-3 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
								isSelected && "border-primary bg-accent",
							)}
						>
							<span className="flex flex-wrap items-center gap-2">
								<Badge variant={priorityLevel.variant}>
									{priorityLevel.label()}
								</Badge>
								<span className="type-label">
									{CITIZEN_REPORT_HAZARD_LABELS[report.hazardKind]()}
								</span>
								{report.isExample && (
									<Badge variant="outline">
										{m.citizen_reports_example_tag()}
									</Badge>
								)}
								<time
									dateTime={report.createdAt.toISOString()}
									className="type-data ml-auto text-muted-foreground"
								>
									{formatRouteReviewRelativeTime(report.createdAt)}
								</time>
							</span>
							<span className="type-body line-clamp-2">{report.description}</span>
						</button>
					</li>
				);
			})}
		</ol>
	);
}
