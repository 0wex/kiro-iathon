import { Button } from "@hack-the-andes-project/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@hack-the-andes-project/ui/components/dropdown-menu";

import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@hack-the-andes-project/ui/components/tooltip";

import { m } from "@/paraglide/messages";
import { getLocale, locales, setLocale } from "@/paraglide/runtime";

interface LanguageToggleProps {
	withTooltip?: boolean;
}

export function LanguageToggle({ withTooltip = false }: LanguageToggleProps) {
	const currentLocale = getLocale();

	const trigger = (
		<Button variant="outline" size="icon" aria-label={m.language_toggle()} />
	);

	return (
		<DropdownMenu>
			<Tooltip>
				<DropdownMenuTrigger
					render={withTooltip ? <TooltipTrigger render={trigger} /> : trigger}
				>
					{currentLocale.toUpperCase()}
				</DropdownMenuTrigger>
				{withTooltip && (
					<TooltipContent side="right">{m.language_toggle()}</TooltipContent>
				)}
			</Tooltip>
			<DropdownMenuContent align="end">
				<DropdownMenuGroup>
					{locales.map((locale) => (
						<DropdownMenuItem
							key={locale}
							lang={locale}
							className="capitalize"
							onClick={() => setLocale(locale)}
						>
							{new Intl.DisplayNames([locale], { type: "language" }).of(locale)}
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
