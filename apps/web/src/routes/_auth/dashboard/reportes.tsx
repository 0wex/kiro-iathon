import type { GeoPoint } from "@iathon-kiro/business/citizen-reports/index";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@iathon-kiro/ui/components/alert";
import { Button } from "@iathon-kiro/ui/components/button";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@iathon-kiro/ui/components/empty";
import { PlusIcon } from "@iathon-kiro/ui/components/icons";
import { Skeleton } from "@iathon-kiro/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense, useRef, useState } from "react";
import { toast } from "sonner";

import { ReportDetail } from "@/components/citizen-reports/report-detail";
import { ReportForm } from "@/components/citizen-reports/report-form";
import { ReportList } from "@/components/citizen-reports/report-list";
import { CITIZEN_REPORT_SKELETON_KEYS } from "@/constants";
import { m } from "@/paraglide/messages";
import { orpc } from "@/utils/orpc";

const ReportMap = lazy(() =>
	import("@/components/citizen-reports/report-map").then((module) => ({
		default: module.ReportMap,
	})),
);

export const Route = createFileRoute("/_auth/dashboard/reportes")({
	component: CitizenReportsPage,
});

function CitizenReportsPage() {
	const queryClient = useQueryClient();
	const reportsQuery = useQuery(orpc.citizenReports.list.queryOptions());
	const [selectedReportId, setSelectedReportId] = useState<string>();
	const [isReporting, setIsReporting] = useState(false);
	const [pickedLocation, setPickedLocation] = useState<GeoPoint | null>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const reports = reportsQuery.data ?? [];
	const selectedReport =
		reports.find((report) => report.id === selectedReportId) ?? reports[0];

	const createReportMutation = useMutation(
		orpc.citizenReports.create.mutationOptions({
			onSuccess: async (createdReport) => {
				setIsReporting(false);
				setPickedLocation(null);
				setSelectedReportId(createdReport.id);
				toast.success(m.citizen_reports_form_success());
				await queryClient.invalidateQueries({
					queryKey: orpc.citizenReports.list.key(),
				});
			},
		}),
	);

	const generatePlanMutation = useMutation(
		orpc.citizenReports.generatePlan.mutationOptions({
			onSuccess: (plan, { reportId }) =>
				queryClient.setQueryData(
					orpc.citizenReports.list.queryKey(),
					(cachedReports) =>
						cachedReports?.map((cachedReport) =>
							cachedReport.id === reportId
								? { ...cachedReport, plan }
								: cachedReport,
						),
				),
		}),
	);
	const isPlanMutationForSelected =
		generatePlanMutation.variables?.reportId === selectedReport?.id;

	const selectReport = (reportId: string) => {
		setSelectedReportId(reportId);
		setIsReporting(false);
		setPickedLocation(null);
		panelRef.current?.focus();
	};

	const startReporting = () => {
		createReportMutation.reset();
		setIsReporting(true);
		panelRef.current?.scrollIntoView({ block: "nearest" });
	};

	return (
		<div className="mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-2">
					<p className="type-title">{m.nav_citizen_reports()}</p>
					<p className="type-body max-w-xl text-muted-foreground">
						{m.citizen_reports_intro()}
					</p>
				</div>
				{!isReporting && (
					<Button className="min-h-11" onClick={startReporting}>
						<PlusIcon data-icon="inline-start" />
						{m.citizen_reports_report_action()}
					</Button>
				)}
			</div>
			{reportsQuery.isError && (
				<Alert variant="destructive">
					<AlertTitle>{m.citizen_reports_load_error_title()}</AlertTitle>
					<AlertDescription>
						{m.citizen_reports_load_error_description()}{" "}
						<Button variant="link" onClick={() => reportsQuery.refetch()}>
							{m.citizen_reports_retry()}
						</Button>
					</AlertDescription>
				</Alert>
			)}
			<div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
				<div className="order-2 flex min-w-0 flex-col gap-3 lg:order-1">
					<h2 className="type-heading">{m.citizen_reports_list_label()}</h2>
					{reportsQuery.isPending ? (
						<output
							aria-label={m.citizen_reports_loading()}
							className="flex flex-col gap-2"
						>
							{CITIZEN_REPORT_SKELETON_KEYS.map((skeletonKey) => (
								<Skeleton key={skeletonKey} className="h-20 w-full" />
							))}
						</output>
					) : reports.length ? (
						<ReportList
							reports={reports}
							selectedReportId={isReporting ? undefined : selectedReport?.id}
							onSelectReport={selectReport}
						/>
					) : (
						reportsQuery.isSuccess && (
							<Empty className="border">
								<EmptyHeader>
									<EmptyTitle>{m.citizen_reports_empty_title()}</EmptyTitle>
									<EmptyDescription>
										{m.citizen_reports_empty_description()}
									</EmptyDescription>
								</EmptyHeader>
							</Empty>
						)
					)}
				</div>
				<div className="order-1 flex min-w-0 flex-col gap-6 lg:order-2">
					<Suspense
						fallback={
							<Skeleton
								aria-label={m.citizen_reports_map_loading()}
								className="h-72 w-full md:h-96"
							/>
						}
					>
						<ReportMap
							reports={reports}
							selectedReportId={isReporting ? undefined : selectedReport?.id}
							onSelectReport={selectReport}
							isPickingLocation={isReporting}
							pickedLocation={pickedLocation}
							onPickLocation={setPickedLocation}
						/>
					</Suspense>
					<div ref={panelRef} tabIndex={-1} className="outline-none">
						{isReporting ? (
							<ReportForm
								location={pickedLocation}
								onLocationChange={setPickedLocation}
								isSubmitting={createReportMutation.isPending}
								submitErrorMessage={createReportMutation.error?.message}
								onSubmit={(input) => createReportMutation.mutate(input)}
								onCancel={() => {
									setIsReporting(false);
									setPickedLocation(null);
								}}
							/>
						) : selectedReport ? (
							<ReportDetail
								report={selectedReport}
								isGeneratingPlan={
									generatePlanMutation.isPending && isPlanMutationForSelected
								}
								planErrorMessage={
									isPlanMutationForSelected
										? generatePlanMutation.error?.message
										: undefined
								}
								onGeneratePlan={() =>
									generatePlanMutation.mutate({ reportId: selectedReport.id })
								}
							/>
						) : (
							reportsQuery.isSuccess && (
								<p className="type-body text-muted-foreground">
									{m.citizen_reports_select_hint()}
								</p>
							)
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
