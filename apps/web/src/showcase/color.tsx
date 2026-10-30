import { ColorPair } from "@hack-the-andes-project/ui/components/showcase/color-pair";
import { ShowcaseSection } from "@hack-the-andes-project/ui/components/showcase/section";
import { m } from "@/paraglide/messages";

const COLOR_PAIRS = [
	{
		name: m.ds_color_canvas,
		background: "background",
		foreground: "foreground",
	},
	{ name: m.ds_color_card, background: "card", foreground: "card-foreground" },
	{
		name: m.ds_color_popover,
		background: "popover",
		foreground: "popover-foreground",
	},
	{
		name: m.ds_color_primary,
		background: "primary",
		foreground: "primary-foreground",
	},
	{
		name: m.ds_color_secondary,
		background: "secondary",
		foreground: "secondary-foreground",
	},
	{
		name: m.ds_color_muted,
		background: "muted",
		foreground: "muted-foreground",
	},
	{
		name: m.ds_color_accent,
		background: "accent",
		foreground: "accent-foreground",
	},
	{
		name: m.ds_color_destructive,
		background: "background",
		foreground: "destructive",
	},
	{
		name: m.ds_color_risk_low,
		background: "risk-low",
		foreground: "risk-low-foreground",
	},
	{
		name: m.ds_color_risk_moderate,
		background: "risk-moderate",
		foreground: "risk-moderate-foreground",
	},
	{
		name: m.ds_color_risk_high,
		background: "risk-high",
		foreground: "risk-high-foreground",
	},
	{
		name: m.ds_color_risk_critical,
		background: "risk-critical",
		foreground: "risk-critical-foreground",
	},
	{ name: m.ds_status_info, background: "info", foreground: "info-foreground" },
	{
		name: m.ds_status_success,
		background: "success",
		foreground: "success-foreground",
	},
	{
		name: m.ds_brand_river,
		background: "background",
		foreground: "brand-river",
	},
	{
		name: m.ds_brand_starlight,
		background: "background",
		foreground: "brand-starlight",
	},
];

const PALETTE_GROUPS = [
	{
		name: m.ds_palette_surfaces,
		description: m.ds_palette_surfaces_description,
		tokens: ["background", "card", "popover", "muted", "secondary", "accent"],
	},
	{
		name: m.ds_palette_ink,
		description: m.ds_palette_ink_description,
		tokens: ["foreground", "muted-foreground", "primary", "primary-foreground"],
	},
	{
		name: m.ds_palette_brand,
		description: m.ds_palette_brand_description,
		tokens: ["brand-river", "brand-starlight"],
	},
	{
		name: m.ds_risk_label,
		description: m.ds_palette_risk_description,
		tokens: ["risk-low", "risk-moderate", "risk-high", "risk-critical"],
	},
	{
		name: m.ds_status_label,
		description: m.ds_palette_status_description,
		tokens: ["info", "success", "destructive"],
	},
	{
		name: m.ds_palette_charts,
		description: m.ds_palette_charts_description,
		tokens: ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5"],
	},
	{
		name: m.ds_palette_lines,
		description: m.ds_palette_lines_description,
		tokens: ["border", "input", "ring"],
	},
	{
		name: m.ds_palette_navigation,
		description: m.ds_palette_navigation_description,
		tokens: [
			"sidebar",
			"sidebar-foreground",
			"sidebar-primary",
			"sidebar-primary-foreground",
			"sidebar-accent",
			"sidebar-accent-foreground",
			"sidebar-border",
			"sidebar-ring",
		],
	},
];

const TOKEN_LABELS: Record<string, () => string> = {
	"risk-low": m.ds_palette_low_label,
	"risk-moderate": m.ds_palette_moderate_label,
	"risk-high": m.ds_palette_high_label,
	"risk-critical": m.ds_palette_critical_label,
	info: m.ds_status_info,
	success: m.ds_status_success,
	"brand-river": m.ds_brand_river,
	"brand-starlight": m.ds_brand_starlight,
};

export function ColorSection() {
	return (
		<ShowcaseSection
			kicker={m.ds_section_kicker()}
			id="color"
			number="01"
			title={m.ds_color_title()}
			description={m.ds_color_description()}
		>
			<div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-3">
				{COLOR_PAIRS.map((pair) => (
					<ColorPair
						key={`${pair.background}-${pair.foreground}`}
						{...pair}
						name={pair.name()}
						contrastLabels={{
							large: m.ds_contrast_large(),
							fail: m.ds_contrast_fail(),
							warning: m.ds_contrast_warning(),
							body: m.ds_contrast_body(),
						}}
						formatContrast={(level, guidance) =>
							m.ds_contrast_result({ level, guidance })
						}
					/>
				))}
			</div>
			<p className="type-body mt-6 max-w-3xl text-muted-foreground">
				{m.ds_color_contrast_guidance()}
			</p>
			<div className="mt-12 flex flex-col gap-10">
				{PALETTE_GROUPS.map((group) => (
					<div
						key={group.name()}
						className="grid gap-5 md:grid-cols-[14rem_1fr]"
					>
						<div>
							<h3 className="type-heading">{group.name()}</h3>
							<p className="type-body mt-2 text-muted-foreground">
								{group.description()}
							</p>
						</div>
						<div className="grid min-w-0 grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
							{group.tokens.map((token) => (
								<div key={token} className="min-w-0">
									<div
										aria-hidden="true"
										className="h-16 rounded-lg border"
										style={{ backgroundColor: `var(--${token})` }}
									/>
									<p className="mt-2 break-words text-xs">
										{TOKEN_LABELS[token]?.() ?? token}
									</p>
									<code className="break-words text-muted-foreground text-xs">
										--{token}
									</code>
								</div>
							))}
						</div>
					</div>
				))}
			</div>
		</ShowcaseSection>
	);
}
