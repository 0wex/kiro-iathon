"use client";

import {
	CircleCheckIcon,
	InfoIcon,
	Loader2Icon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import type { CSSProperties } from "react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

interface ToastThemeStyle extends CSSProperties {
	[property: `--${string}`]: string;
}

const toastThemeStyle: ToastThemeStyle = {
	fontFamily: "var(--font-sans)",
	"--normal-bg": "var(--popover)",
	"--normal-text": "var(--popover-foreground)",
	"--normal-border": "var(--border)",
	"--normal-bg-hover": "var(--popover)",
	"--normal-border-hover": "var(--border)",
	"--border-radius": "var(--radius-lg)",
};

const Toaster = ({ ...props }: ToasterProps) => {
	const { theme = "system" } = useTheme();

	return (
		<Sonner
			theme={theme === "light" || theme === "dark" ? theme : "system"}
			className="toaster group"
			icons={{
				success: <CircleCheckIcon className="size-4 text-success" />,
				info: <InfoIcon className="size-4 text-info" />,
				warning: <TriangleAlertIcon className="size-4 text-risk-high" />,
				error: <OctagonXIcon className="size-4 text-destructive" />,
				loading: (
					<Loader2Icon className="size-4 animate-spin text-muted-foreground" />
				),
			}}
			style={toastThemeStyle}
			toastOptions={{
				classNames: {
					toast:
						"cn-toast items-start! gap-3! px-4! py-3! shadow-none! focus-visible:outline-1! focus-visible:outline-ring!",
					icon: "mt-0.5! ml-0! size-4! shrink-0!",
					content: "flex! min-w-0! flex-1! flex-col! gap-0.5!",
					title: "font-sans! font-semibold! text-sm/5! text-foreground!",
					description: "font-sans! text-muted-foreground! text-sm/5!",
					actionButton:
						"mt-0.5! h-7! shrink-0! rounded-md! border! border-border! bg-background! px-2.5! font-sans! font-semibold! text-foreground! text-sm! shadow-none! transition-colors! hover:bg-muted! focus-visible:outline-1! focus-visible:outline-ring!",
					cancelButton:
						"mt-0.5! h-7! shrink-0! rounded-md! bg-secondary! px-2.5! font-sans! font-semibold! text-secondary-foreground! text-sm! shadow-none! focus-visible:outline-1! focus-visible:outline-ring!",
					closeButton:
						"rounded-md! border-border! bg-popover! text-muted-foreground! shadow-none! hover:bg-muted! hover:text-foreground! focus-visible:outline-1! focus-visible:outline-ring!",
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };
