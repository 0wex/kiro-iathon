import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@hack-the-andes-project/ui/components/card";
import { ShowcaseSection } from "@hack-the-andes-project/ui/components/showcase/section";
import { cn } from "@hack-the-andes-project/ui/lib/utils";
import { SHOWCASE_RADIUS_SCALE, SPACING_SCALE } from "@/constants";
import { m } from "@/paraglide/messages";

export function SpacingSection() {
	return (
		<ShowcaseSection
			kicker={m.ds_section_kicker()}
			id="espacio"
			number="03"
			title={m.ds_spacing_title()}
			description={m.ds_spacing_description()}
		>
			<div className="grid gap-12 md:grid-cols-2">
				<div className="flex flex-col gap-3">
					<h3 className="type-heading mb-3">{m.ds_spacing_scale()}</h3>
					{SPACING_SCALE.map((spacing) => (
						<div
							key={spacing.token}
							className="grid grid-cols-[2rem_5rem_1fr] items-center gap-4"
						>
							<code className="type-data">{spacing.token}</code>
							<span className="type-data text-muted-foreground">
								{spacing.size}
							</span>
							<div className={cn("h-4 bg-foreground", spacing.className)} />
						</div>
					))}
					<p className="type-body mt-4 text-muted-foreground">
						{m.ds_spacing_ladder()}
					</p>
				</div>
				<div className="flex flex-col gap-6">
					<h3 className="type-heading">{m.ds_radius_title()}</h3>
					<div className="grid grid-cols-2 gap-5 sm:grid-cols-4 md:grid-cols-2 xl:grid-cols-4">
						{SHOWCASE_RADIUS_SCALE.map((radius) => (
							<div key={radius.token} className="flex min-w-0 flex-col gap-3">
								<div
									className={cn(
										"type-data grid size-20 place-items-center border bg-card",
										radius.token,
									)}
								>
									{radius.size}
								</div>
								<code className="type-data break-words">{radius.token}</code>
								<p className="type-body text-muted-foreground">
									{radius.role()}
								</p>
							</div>
						))}
					</div>
					<p className="type-body text-muted-foreground">
						{m.ds_radius_description()}
					</p>
				</div>
			</div>
			<div className="mt-12 grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader>
						<CardTitle>{m.ds_color_card()}</CardTitle>
						<CardDescription>{m.ds_card_surface_description()}</CardDescription>
					</CardHeader>
					<CardContent>{m.ds_card_surface_spec()}</CardContent>
				</Card>
				<div className="flex flex-col gap-4 rounded-lg border bg-popover p-4 text-popover-foreground">
					<h3 className="type-heading">{m.ds_color_popover()}</h3>
					<p className="text-muted-foreground text-sm">
						{m.ds_popover_surface_description()}
					</p>
					<p className="text-sm">{m.ds_popover_surface_spec()}</p>
				</div>
				<div className="rounded-lg border bg-foreground/15 p-4">
					<div className="flex h-full flex-col gap-4 rounded-lg border bg-background p-4">
						<h3 className="type-heading">{m.ds_dialog_title()}</h3>
						<p className="text-muted-foreground text-sm">
							{m.ds_dialog_surface_description()}
						</p>
						<p className="text-sm">{m.ds_dialog_surface_spec()}</p>
					</div>
				</div>
			</div>
		</ShowcaseSection>
	);
}
