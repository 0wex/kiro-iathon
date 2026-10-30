"use client";

import { useEffect, useState } from "react";

interface TokenColors {
	[tokenName: string]: string;
}

export function useTokenColors(tokenNames: readonly string[]) {
	const tokenNamesKey = tokenNames.join(" ");
	const [tokenColors, setTokenColors] = useState<TokenColors>({});

	useEffect(() => {
		const rootElement = document.documentElement;
		const requestedTokens = tokenNamesKey ? tokenNamesKey.split(" ") : [];
		const updateTokenColors = () => {
			const rootStyles = getComputedStyle(rootElement);
			setTokenColors(
				Object.fromEntries(
					requestedTokens.map((tokenName) => [
						tokenName,
						rootStyles.getPropertyValue(tokenName).trim(),
					]),
				),
			);
		};
		updateTokenColors();
		const observer = new MutationObserver(updateTokenColors);
		observer.observe(rootElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
		return () => observer.disconnect();
	}, [tokenNamesKey]);

	return tokenColors;
}
