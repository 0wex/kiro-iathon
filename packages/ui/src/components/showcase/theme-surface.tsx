import { cn } from "cn";
import { type ReactNode, useLayoutEffect, useRef } from "react";

interface ThemeSurfaceProps {
	theme: "light" | "dark";
	children: ReactNode;
}

export function ThemeSurface({ theme, children }: ThemeSurfaceProps) {
	const surfaceRef = useRef<HTMLElement>(null);

	useLayoutEffect(() => {
		const declarations = new Map<string, string>();
		const selectors = theme === "dark" ? [":root", ".dark"] : [":root"];
		for (const selector of selectors) {
			const collectDeclarations = (rules: CSSRuleList) => {
				for (const rule of rules) {
					if (rule instanceof CSSStyleRule && rule.selectorText === selector) {
						for (const property of rule.style) {
							if (property.startsWith("--")) {
								declarations.set(
									property,
									rule.style.getPropertyValue(property),
								);
							}
						}
					} else if (rule instanceof CSSGroupingRule) {
						collectDeclarations(rule.cssRules);
					}
				}
			};
			for (const stylesheet of document.styleSheets) {
				if (
					stylesheet.href &&
					new URL(stylesheet.href).origin !== location.origin
				)
					continue;
				collectDeclarations(stylesheet.cssRules);
			}
		}
		// Scope the existing theme tokens without changing the page theme or duplicating its palette.
		for (const [property, value] of declarations) {
			surfaceRef.current?.style.setProperty(property, value);
		}
	}, [theme]);

	return (
		<figure
			ref={surfaceRef}
			className={cn(
				theme,
				"flex min-w-0 flex-col items-center gap-6 rounded-lg border border-border bg-background p-8 text-foreground",
			)}
		>
			{children}
		</figure>
	);
}
