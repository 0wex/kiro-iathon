import { ThemeSwitch } from "@hack-the-andes-project/ui/components/theme-switch";
import { useLayoutEffect, useState } from "react";

import { ILLAPA_THEME_STORAGE_KEY } from "@/constants";

export default function ThemeSwitchIsland() {
	const [isDark, setIsDark] = useState(false);

	useLayoutEffect(() => {
		const syncTheme = () => {
			let nextIsDark = document.documentElement.classList.contains("dark");
			try {
				nextIsDark = localStorage.getItem(ILLAPA_THEME_STORAGE_KEY) === "dark";
			} catch {
				setIsDark(nextIsDark);
				return;
			}
			document.documentElement.classList.toggle("dark", nextIsDark);
			document.documentElement.classList.toggle("light", !nextIsDark);
			setIsDark(nextIsDark);
		};
		const handleStorageChange = (event: StorageEvent) => {
			if (event.key === ILLAPA_THEME_STORAGE_KEY || event.key === null) {
				syncTheme();
			}
		};
		syncTheme();
		window.addEventListener("storage", handleStorageChange);
		return () => window.removeEventListener("storage", handleStorageChange);
	}, []);

	return (
		<ThemeSwitch
			isDark={isDark}
			label="Modo oscuro"
			onIsDarkChange={(nextIsDark) => {
				document.documentElement.classList.toggle("dark", nextIsDark);
				document.documentElement.classList.toggle("light", !nextIsDark);
				setIsDark(nextIsDark);
				try {
					localStorage.setItem(
						ILLAPA_THEME_STORAGE_KEY,
						nextIsDark ? "dark" : "light",
					);
				} catch {
					return;
				}
			}}
		/>
	);
}
