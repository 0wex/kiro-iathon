import {
	RainStreaks,
	StarRiver,
} from "@hack-the-andes-project/ui/components/mayu-art";
import { LanguageToggle } from "@/components/language-toggle";
import { ThemeSwitchControl } from "@/components/theme-switch-control";
import { SHOWCASE_SECTIONS } from "@/constants";
import { m } from "@/paraglide/messages";

export function HeroSection() {
	return (
		<header className="relative isolate overflow-hidden border-b bg-background text-foreground">
			<StarRiver className="pointer-events-none absolute inset-0 size-full opacity-50" />
			<RainStreaks className="pointer-events-none text-brand-river/15" />
			<div className="relative mx-auto flex max-w-7xl flex-col gap-12 px-5 py-16 sm:px-8 md:py-24">
				<div className="flex items-start justify-between gap-4">
					<p className="type-label max-w-xs">{m.ds_hero_kicker()}</p>
					<div className="flex items-center gap-3">
						<span className="type-label hidden sm:inline">
							{m.ds_appearance()}
						</span>
						<ThemeSwitchControl />
						<LanguageToggle />
					</div>
				</div>
				<div className="flex max-w-2xl flex-col gap-6">
					<h1 className="type-display">{m.ds_hero_title()}</h1>
					<p className="type-lead max-w-lg">{m.ds_hero_description()}</p>
					<p className="type-body max-w-lg text-muted-foreground">
						{m.ds_hero_concept()}
					</p>
				</div>
				<nav
					aria-label={m.ds_sections_navigation()}
					className="flex flex-wrap gap-x-6 gap-y-4"
				>
					{SHOWCASE_SECTIONS.map((section) => (
						<a
							key={section.id}
							href={`#${section.id}`}
							className="type-label underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-ring"
						>
							{section.label()}
						</a>
					))}
				</nav>
			</div>
		</header>
	);
}
