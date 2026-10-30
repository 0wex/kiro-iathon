import {
	IllapaLockup,
	IllapaMark,
} from "@hack-the-andes-project/ui/components/illapa-logo";
import { ThemeSurface } from "@hack-the-andes-project/ui/components/showcase/theme-surface";
import { SHOWCASE_APP_ICON_SIZES_PX } from "@/constants";
import { m } from "@/paraglide/messages";

export function LogoBlock() {
	return (
		<section
			id="logo"
			aria-labelledby="logo-title"
			className="mt-12 flex scroll-mt-8 flex-col gap-6 border-t pt-12"
		>
			<div className="flex max-w-3xl flex-col gap-3">
				<p className="type-label text-muted-foreground">{m.ds_logo_kicker()}</p>
				<h3 id="logo-title" className="type-title">
					{m.ds_logo_title()}
				</h3>
				<p className="type-body text-muted-foreground">
					{m.ds_logo_description()}
				</p>
			</div>
			<div className="grid gap-4 md:grid-cols-2">
				<ThemeSurface theme="light">
					<IllapaMark className="size-24" title={m.ds_logo_mark_label()} />
					<IllapaLockup markClassName="size-10" wordmarkClassName="text-4xl" />
					<figcaption className="type-label">
						{m.ds_logo_light_surface()}
					</figcaption>
				</ThemeSurface>
				<ThemeSurface theme="dark">
					<IllapaMark className="size-24" title={m.ds_logo_mark_label()} />
					<IllapaLockup markClassName="size-10" wordmarkClassName="text-4xl" />
					<figcaption className="type-label">
						{m.ds_logo_dark_surface()}
					</figcaption>
				</ThemeSurface>
			</div>
			<div className="flex flex-col gap-6 rounded-lg border bg-card p-6 text-card-foreground">
				<h4 className="type-heading">{m.ds_logo_app_icon()}</h4>
				<div className="flex flex-wrap items-end gap-8">
					{SHOWCASE_APP_ICON_SIZES_PX.map((sizePx) => (
						<figure key={sizePx} className="flex flex-col items-center gap-3">
							<img
								src="/favicon.svg"
								width={sizePx}
								height={sizePx}
								alt={m.ds_logo_app_icon()}
							/>
							<figcaption className="type-data">
								{m.ds_logo_icon_size({ size: sizePx })}
							</figcaption>
						</figure>
					))}
				</div>
			</div>
			<div className="flex flex-col gap-3">
				<h4 className="type-heading">{m.ds_logo_rules_title()}</h4>
				<ul className="type-body flex list-disc flex-col gap-2 pl-5">
					<li>{m.ds_logo_clear_space()}</li>
					<li>{m.ds_logo_minimum_size()}</li>
					<li>{m.ds_logo_colors()}</li>
					<li>{m.ds_logo_geometry()}</li>
					<li>{m.ds_logo_backgrounds()}</li>
				</ul>
			</div>
		</section>
	);
}
