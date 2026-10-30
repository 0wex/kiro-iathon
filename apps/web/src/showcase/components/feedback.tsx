import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@hack-the-andes-project/ui/components/alert";
import { Button } from "@hack-the-andes-project/ui/components/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@hack-the-andes-project/ui/components/empty";
import {
	Progress,
	ProgressLabel,
	ProgressValue,
} from "@hack-the-andes-project/ui/components/progress";
import { MapPinIcon } from "@hack-the-andes-project/ui/components/showcase/icons";
import { ShowcaseTier } from "@hack-the-andes-project/ui/components/showcase/tier";
import { ShowcaseToastViewport } from "@hack-the-andes-project/ui/components/showcase/toast-viewport";
import { Skeleton } from "@hack-the-andes-project/ui/components/skeleton";
import { Toaster } from "@hack-the-andes-project/ui/components/sonner";
import {
	toast as baseToast,
	ToastProvider,
} from "@hack-the-andes-project/ui/components/toast";
import { toast } from "sonner";
import { SHOWCASE_PROGRESS_PERCENT, SHOWCASE_TOASTER_ID } from "@/constants";
import { m } from "@/paraglide/messages";

export function FeedbackShowcase() {
	return (
		<ShowcaseTier
			id="components-feedback"
			title={m.ds_tier_feedback()}
			description={m.ds_tier_feedback_description()}
		>
			<div className="flex flex-col gap-5">
				<h3 className="type-heading">{m.ds_notifications_title()}</h3>
				<div className="flex flex-wrap gap-2">
					<Button
						variant="outline"
						onClick={() =>
							toast.success(m.ds_toast_route_saved(), {
								toasterId: SHOWCASE_TOASTER_ID,
								description: m.ds_toast_route_saved_description(),
							})
						}
					>
						{m.ds_status_success()}
					</Button>
					<Button
						variant="outline"
						onClick={() =>
							toast.info(m.ds_toast_alert_updated(), {
								toasterId: SHOWCASE_TOASTER_ID,
								description: m.ds_toast_alert_updated_description(),
							})
						}
					>
						{m.ds_status_info()}
					</Button>
					<Button
						variant="outline"
						onClick={() =>
							toast.warning(m.ds_senamhi_orange_warning(), {
								toasterId: SHOWCASE_TOASTER_ID,
								description: m.ds_heavy_rain_forecast(),
							})
						}
					>
						{m.ds_warning()}
					</Button>
					<Button
						variant="outline"
						onClick={() =>
							toast.error(m.ds_toast_save_failed(), {
								toasterId: SHOWCASE_TOASTER_ID,
								description: m.ds_toast_save_failed_description(),
							})
						}
					>
						{m.ds_error()}
					</Button>
				</div>
			</div>
			<div className="grid gap-6 md:grid-cols-2">
				<div
					className="flex flex-col gap-5 rounded-lg border p-6"
					role="status"
					aria-label={m.ds_loading_route_summary()}
				>
					<h3 className="type-heading">{m.ds_skeleton_title()}</h3>
					<Skeleton className="h-5 w-2/3" />
					<Skeleton className="h-4 w-full" />
					<Skeleton className="h-4 w-4/5" />
					<Skeleton className="h-24 w-full" />
					<p className="text-muted-foreground text-xs">
						{m.ds_loading_route_status()}
					</p>
				</div>
				<Empty className="border">
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<MapPinIcon />
						</EmptyMedia>
						<EmptyTitle>{m.ds_empty_title()}</EmptyTitle>
						<EmptyDescription>{m.ds_empty_description()}</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<Button onClick={() => toast.success(m.ds_toast_route_added())}>
							{m.ds_add_route()}
						</Button>
					</EmptyContent>
				</Empty>
			</div>
			<Alert variant="info">
				<AlertTitle>{m.ds_toast_alert_updated()}</AlertTitle>
				<AlertDescription>
					{m.ds_toast_alert_updated_description()}
				</AlertDescription>
			</Alert>
			<Progress value={SHOWCASE_PROGRESS_PERCENT}>
				<ProgressLabel>{m.ds_progress_label()}</ProgressLabel>
				<ProgressValue />
			</Progress>
			<ToastProvider toastManager={baseToast}>
				<div>
					<Button
						variant="outline"
						onClick={() =>
							baseToast.add({
								title: m.ds_toast_route_saved(),
								description: m.ds_toast_route_saved_description(),
								type: "success",
							})
						}
					>
						{m.ds_toast_preview()}
					</Button>
				</div>
				<ShowcaseToastViewport closeLabel={m.ds_close()} />
			</ToastProvider>
			<Toaster
				id={SHOWCASE_TOASTER_ID}
				containerAriaLabel={m.ds_notifications_title()}
			/>
		</ShowcaseTier>
	);
}
