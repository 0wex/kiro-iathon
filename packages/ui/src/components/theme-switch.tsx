"use client";

import { MoonIcon, SunIcon } from "lucide-react";

import { cn } from "../lib/utils";
import { Switch } from "./switch";

export interface ThemeSwitchProps {
	isDark: boolean;
	onIsDarkChange: (isDark: boolean) => void;
	label: string;
	showLabel?: boolean;
	className?: string;
}

export function ThemeSwitch({
	isDark,
	onIsDarkChange,
	label,
	showLabel = false,
	className,
}: ThemeSwitchProps) {
	return (
		<div className={cn("flex items-center gap-2", className)}>
			{showLabel && <span className="font-medium text-sm">{label}</span>}
			<SunIcon
				aria-hidden="true"
				className={cn("size-4 shrink-0", isDark && "text-muted-foreground")}
			/>
			<Switch
				checked={isDark}
				onCheckedChange={onIsDarkChange}
				aria-label={label}
				className="motion-reduce:transition-none motion-reduce:*:transition-none"
			/>
			<MoonIcon
				aria-hidden="true"
				className={cn("size-4 shrink-0", !isDark && "text-muted-foreground")}
			/>
		</div>
	);
}
