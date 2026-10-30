import { Badge } from "@hack-the-andes-project/ui/components/badge";
import { Button } from "@hack-the-andes-project/ui/components/button";
import { ButtonGroup } from "@hack-the-andes-project/ui/components/button-group";
import { Kbd, KbdGroup } from "@hack-the-andes-project/ui/components/kbd";
import {
	ArrowRightIcon,
	BellIcon,
	SearchIcon,
} from "@hack-the-andes-project/ui/components/showcase/icons";
import {
	previewState,
	StateMatrix,
} from "@hack-the-andes-project/ui/components/showcase/state-matrix";
import { ShowcaseTier } from "@hack-the-andes-project/ui/components/showcase/tier";
import { Spinner } from "@hack-the-andes-project/ui/components/spinner";
import { Toggle } from "@hack-the-andes-project/ui/components/toggle";
import {
	ToggleGroup,
	ToggleGroupItem,
} from "@hack-the-andes-project/ui/components/toggle-group";
import type { ComponentProps } from "react";
import { getShowcaseStateLabels } from "@/constants";
import { m } from "@/paraglide/messages";

const BUTTON_VARIANTS: NonNullable<ComponentProps<typeof Button>["variant"]>[] =
	["default", "secondary", "outline", "ghost", "destructive", "link"];
const BUTTON_SIZES: NonNullable<ComponentProps<typeof Button>["size"]>[] = [
	"xs",
	"sm",
	"default",
	"lg",
];
const ICON_SIZES: NonNullable<ComponentProps<typeof Button>["size"]>[] = [
	"icon-xs",
	"icon-sm",
	"icon",
	"icon-lg",
];
interface BadgeExample {
	variant: NonNullable<ComponentProps<typeof Badge>["variant"]>;
	label: () => string;
}
const BADGE_EXAMPLES: BadgeExample[] = [
	{ variant: "default", label: m.ds_selected_route },
	{ variant: "secondary", label: m.ds_under_review },
	{ variant: "outline", label: m.ds_sample_route_code },
	{ variant: "ghost", label: m.ds_detail },
	{ variant: "destructive", label: m.ds_record_error },
	{ variant: "link", label: m.ds_view_source },
	{ variant: "low", label: m.risk_low },
	{ variant: "moderate", label: m.risk_moderate },
	{ variant: "high", label: m.risk_high },
	{ variant: "critical", label: m.risk_critical },
	{ variant: "info", label: m.ds_status_info },
	{ variant: "success", label: m.ds_saved },
];
export function ActionsShowcase() {
	const stateLabels = getShowcaseStateLabels();
	return (
		<ShowcaseTier
			id="components-actions"
			title={m.ds_tier_actions()}
			description={m.ds_tier_actions_description()}
		>
			<div className="flex min-w-0 flex-col gap-6">
				<div>
					<h3 className="type-heading">{m.ds_buttons_title()}</h3>
					<p className="mt-2 text-muted-foreground text-sm">
						{m.ds_buttons_description()}
					</p>
				</div>
				<div className="flex flex-wrap gap-3">
					<Button>
						{m.ds_evaluate_route()}
						<ArrowRightIcon data-icon="inline-end" />
					</Button>
					<Button variant="outline">{m.ds_view_sources()}</Button>
				</div>
				<StateMatrix
					variantLabel={m.ds_variant()}
					stateLabels={stateLabels}
					rows={BUTTON_VARIANTS}
					render={(variant, state) => (
						<Button variant={variant} {...previewState(state)}>
							{variant === "destructive"
								? m.ds_delete_alert()
								: m.ds_evaluate_route()}
						</Button>
					)}
				/>
				<div className="grid gap-8 lg:grid-cols-2">
					<div className="flex flex-col gap-4">
						<p className="type-label text-muted-foreground">{m.ds_sizes()}</p>
						<div className="flex flex-wrap items-end gap-4">
							{BUTTON_SIZES.map((size) => (
								<div key={size} className="flex flex-col items-start gap-2">
									<code className="text-muted-foreground text-xs">{size}</code>
									<Button size={size}>{m.recommendation_continue()}</Button>
								</div>
							))}
						</div>
					</div>
					<div className="flex flex-col gap-4">
						<p className="type-label text-muted-foreground">
							{m.ds_icon_buttons()}
						</p>
						<div className="flex flex-wrap items-end gap-4">
							{ICON_SIZES.map((size) => (
								<div key={size} className="flex flex-col items-start gap-2">
									<code className="text-muted-foreground text-xs">{size}</code>
									<Button
										size={size}
										variant="outline"
										aria-label={m.ds_search_route()}
									>
										<SearchIcon />
									</Button>
								</div>
							))}
						</div>
					</div>
				</div>
				<div className="flex flex-wrap items-center gap-4">
					<Button disabled aria-busy="true">
						<Spinner
							aria-label={m.ds_evaluating_route()}
							data-icon="inline-start"
						/>
						{m.ds_evaluating_route()}
					</Button>
					<Button variant="outline">
						<BellIcon data-icon="inline-start" />
						{m.recommendation_monitor()}
					</Button>
					<Button variant="secondary" className="max-w-full">
						<span className="truncate">{m.ds_monitor_long_route()}</span>
					</Button>
				</div>
			</div>
			<div className="flex flex-col gap-6">
				<h3 className="type-heading">{m.ds_badges_title()}</h3>
				<div className="flex flex-wrap gap-3">
					{BADGE_EXAMPLES.map((badge) => (
						<div key={badge.variant} className="flex flex-col gap-2">
							<code className="text-muted-foreground text-xs">
								{badge.variant}
							</code>
							<Badge variant={badge.variant}>{badge.label()}</Badge>
						</div>
					))}
				</div>
				<div className="max-w-full">
					<Badge variant="outline" className="max-w-full">
						<span className="truncate">{m.ds_long_badge()}</span>
					</Badge>
					<p className="mt-2 text-muted-foreground text-xs">
						{m.ds_long_badge_hint()}
					</p>
				</div>
			</div>
			<div className="flex flex-wrap items-center gap-6">
				<ButtonGroup aria-label={m.ds_route_actions()}>
					<Button>{m.ds_evaluate_route()}</Button>
					<Button variant="outline">{m.ds_view_sources()}</Button>
				</ButtonGroup>
				<div className="flex flex-wrap items-center gap-3">
					<span className="type-label">{m.ds_filter_risk()}</span>
					<ToggleGroup
						multiple
						defaultValue={["high"]}
						aria-label={m.ds_filter_risk()}
						variant="outline"
					>
						<ToggleGroupItem value="high">{m.risk_high()}</ToggleGroupItem>
						<ToggleGroupItem value="critical">
							{m.risk_critical()}
						</ToggleGroupItem>
					</ToggleGroup>
				</div>
				<p className="flex items-center gap-3 text-sm">
					<KbdGroup>
						<Kbd>⌘</Kbd>
						<Kbd>K</Kbd>
					</KbdGroup>
					{m.ds_keyboard_hint()}
				</p>
			</div>
			<StateMatrix
				variantLabel={m.ds_variant()}
				stateLabels={stateLabels}
				rows={["default", "outline"]}
				render={(variant, state) => (
					<Toggle
						variant={variant === "outline" ? "outline" : "default"}
						aria-label={m.ds_receive_alerts()}
						defaultPressed={state === "active"}
						{...previewState(state)}
					>
						<BellIcon />
						{m.ds_receive_alerts()}
					</Toggle>
				)}
			/>

			<StateMatrix
				variantLabel={m.ds_variant()}
				stateLabels={stateLabels}
				rows={["ToggleGroup"]}
				render={(_, state) => (
					<ToggleGroup
						defaultValue={["high"]}
						aria-label={m.ds_filter_risk()}
						disabled={state === "disabled"}
					>
						<ToggleGroupItem value="high" {...previewState(state)}>
							{m.risk_high()}
						</ToggleGroupItem>
						<ToggleGroupItem value="critical" {...previewState(state)}>
							{m.risk_critical()}
						</ToggleGroupItem>
					</ToggleGroup>
				)}
			/>
		</ShowcaseTier>
	);
}
