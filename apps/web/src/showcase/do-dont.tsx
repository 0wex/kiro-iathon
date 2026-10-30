import { Badge } from "@hack-the-andes-project/ui/components/badge";
import { Button } from "@hack-the-andes-project/ui/components/button";
import { ShowcaseSection } from "@hack-the-andes-project/ui/components/showcase/section";
import { m } from "@/paraglide/messages";

export function DoDontSection() {
	return (
		<ShowcaseSection
			kicker={m.ds_section_kicker()}
			id="criterios"
			number="07"
			title={m.ds_guidelines_title()}
			description={m.ds_guidelines_description()}
		>
			<div className="flex flex-col gap-8">
				<div>
					<h3 className="type-heading mb-4">{m.ds_brand_rule()}</h3>
					<div className="grid gap-4 md:grid-cols-2">
						<div className="flex flex-col items-start gap-5 rounded-lg border p-6">
							<p className="type-label">{m.ds_brand_do()}</p>
							<Badge variant="low">{m.ds_palette_low_label()}</Badge>
							<p className="text-muted-foreground text-sm">
								{m.ds_brand_do_description()}
							</p>
						</div>
						<div className="flex flex-col items-start gap-5 rounded-lg border p-6">
							<p className="type-label text-destructive">{m.ds_brand_dont()}</p>
							<span className="type-label rounded-md bg-brand-river px-2 py-1 text-primary-foreground">
								{m.ds_palette_low_label()}
							</span>
							<p className="text-muted-foreground text-sm">
								{m.ds_brand_dont_description()}
							</p>
						</div>
					</div>
				</div>
				<div>
					<h3 className="type-heading mb-4">{m.ds_label_rule()}</h3>
					<div className="grid gap-4 md:grid-cols-2">
						<div className="flex flex-col items-start gap-5 rounded-lg border p-6">
							<p className="type-label">{m.ds_label_do()}</p>
							<Badge variant="critical">{m.ds_critical_closure()}</Badge>
							<p className="text-muted-foreground text-sm">
								{m.ds_label_do_description()}
							</p>
						</div>
						<div className="flex flex-col items-start gap-5 rounded-lg border p-6">
							<p className="type-label text-destructive">{m.ds_label_dont()}</p>
							<span
								className="size-3 rounded-full bg-risk-critical"
								role="img"
								aria-label={m.ds_unlabeled_indicator()}
							/>
							<p className="text-muted-foreground text-sm">
								{m.ds_label_dont_description()}
							</p>
						</div>
					</div>
				</div>
				<div>
					<h3 className="type-heading mb-4">{m.ds_action_rule()}</h3>
					<div className="grid gap-4 md:grid-cols-2">
						<div className="flex flex-col items-start gap-5 rounded-lg border p-6">
							<p className="type-label">{m.ds_action_do()}</p>
							<div className="flex flex-wrap gap-2">
								<Button>{m.ds_evaluate_reroute()}</Button>
								<Button variant="outline">{m.ds_view_source()}</Button>
							</div>
							<p className="text-muted-foreground text-sm">
								{m.ds_action_do_description()}
							</p>
						</div>
						<div className="flex flex-col items-start gap-5 rounded-lg border p-6">
							<p className="type-label text-destructive">
								{m.ds_action_dont()}
							</p>
							<div className="flex flex-wrap gap-2">
								<Button>{m.ds_evaluate_reroute()}</Button>
								<Button>{m.ds_view_source()}</Button>
							</div>
							<p className="text-muted-foreground text-sm">
								{m.ds_action_dont_description()}
							</p>
						</div>
					</div>
				</div>
			</div>
		</ShowcaseSection>
	);
}
