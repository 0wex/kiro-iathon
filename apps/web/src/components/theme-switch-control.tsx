import { ThemeSwitch } from "@hack-the-andes-project/ui/components/theme-switch";
import { useTheme } from "@/components/theme-provider";
import { m } from "@/paraglide/messages";

interface ThemeSwitchControlProps {
	showLabel?: boolean;
	className?: string;
}

export function ThemeSwitchControl({
	showLabel,
	className,
}: ThemeSwitchControlProps) {
	const { resolvedTheme, setTheme } = useTheme();

	return (
		<ThemeSwitch
			isDark={resolvedTheme === "dark"}
			onIsDarkChange={(isDark) => setTheme(isDark ? "dark" : "light")}
			label={m.theme_dark_mode()}
			showLabel={showLabel}
			className={className}
		/>
	);
}
