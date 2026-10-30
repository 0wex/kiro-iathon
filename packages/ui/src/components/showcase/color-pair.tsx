import { cn } from "cn";
import { useEffect, useRef, useState } from "react";
import {
	COLOR_SAMPLE_SIZE_PX,
	CONTRAST_AA_RATIO,
	CONTRAST_AAA_RATIO,
	CONTRAST_DECIMAL_PLACES,
	CONTRAST_LARGE_RATIO,
	CONTRAST_OFFSET,
	HEX_CHANNEL_LENGTH,
	HEX_RADIX,
	LUMINANCE_BLUE_WEIGHT,
	LUMINANCE_GREEN_WEIGHT,
	LUMINANCE_RED_WEIGHT,
	RGB_CHANNEL_MAX,
	SRGB_EXPONENT,
	SRGB_LINEAR_DIVISOR,
	SRGB_LINEAR_THRESHOLD,
	SRGB_OFFSET,
	SRGB_SCALE,
} from "./constants";

interface RgbColor {
	red: number;
	green: number;
	blue: number;
}
interface ColorInfo {
	ratio: number;
	background: string;
	foreground: string;
}
interface ColorPairProps {
	name: string;
	background: string;
	foreground: string;
	className?: string;
	contrastLabels: ContrastLabels;
	formatContrast: (level: string, guidance: string) => string;
}

interface ContrastLabels {
	large: string;
	fail: string;
	warning: string;
	body: string;
}

// Canvas resolves CSS color spaces to sRGB and composites translucent ink over its surface.
function resolveRgb(color: string, backdrop: string): RgbColor | null {
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = COLOR_SAMPLE_SIZE_PX;
	const context = canvas.getContext("2d", { willReadFrequently: true });
	if (!context) return null;
	context.fillStyle = backdrop;
	context.fillRect(0, 0, COLOR_SAMPLE_SIZE_PX, COLOR_SAMPLE_SIZE_PX);
	context.fillStyle = color;
	context.fillRect(0, 0, COLOR_SAMPLE_SIZE_PX, COLOR_SAMPLE_SIZE_PX);
	const [red = 0, green = 0, blue = 0] = context.getImageData(
		0,
		0,
		COLOR_SAMPLE_SIZE_PX,
		COLOR_SAMPLE_SIZE_PX,
	).data;
	return { red, green, blue };
}

function toHex(color: RgbColor) {
	return `#${[color.red, color.green, color.blue].map((channel) => channel.toString(HEX_RADIX).padStart(HEX_CHANNEL_LENGTH, "0")).join("")}`;
}

function luminance(color: RgbColor) {
	return [
		{ channel: color.red, weight: LUMINANCE_RED_WEIGHT },
		{ channel: color.green, weight: LUMINANCE_GREEN_WEIGHT },
		{ channel: color.blue, weight: LUMINANCE_BLUE_WEIGHT },
	].reduce((total, { channel, weight }) => {
		const normalizedChannel = channel / RGB_CHANNEL_MAX;
		const linearChannel =
			normalizedChannel <= SRGB_LINEAR_THRESHOLD
				? normalizedChannel / SRGB_LINEAR_DIVISOR
				: ((normalizedChannel + SRGB_OFFSET) / SRGB_SCALE) ** SRGB_EXPONENT;
		return total + linearChannel * weight;
	}, 0);
}

export function ColorPair({
	name,
	background,
	foreground,
	className,
	contrastLabels,
	formatContrast,
}: ColorPairProps) {
	const sampleRef = useRef<HTMLDivElement>(null);
	const [info, setInfo] = useState<ColorInfo | null>(null);
	useEffect(() => {
		const sample = sampleRef.current;
		if (!sample) return;
		// Re-measure when next-themes changes the class on html.
		const measure = () => {
			const sampleStyle = getComputedStyle(sample);
			const surface = resolveRgb(
				sampleStyle.backgroundColor,
				getComputedStyle(document.body).backgroundColor,
			);
			if (!surface) return;
			const ink = resolveRgb(sampleStyle.color, toHex(surface));
			if (!ink) return;
			const surfaceLuminance = luminance(surface);
			const inkLuminance = luminance(ink);
			setInfo({
				ratio:
					(Math.max(surfaceLuminance, inkLuminance) + CONTRAST_OFFSET) /
					(Math.min(surfaceLuminance, inkLuminance) + CONTRAST_OFFSET),
				background: toHex(surface),
				foreground: toHex(ink),
			});
		};
		measure();
		const observer = new MutationObserver(measure);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class", "style"],
		});
		return () => observer.disconnect();
	}, []);
	const level = !info
		? ""
		: info.ratio >= CONTRAST_AAA_RATIO
			? "AAA"
			: info.ratio >= CONTRAST_AA_RATIO
				? "AA"
				: info.ratio >= CONTRAST_LARGE_RATIO
					? contrastLabels.large
					: contrastLabels.fail;
	return (
		<div
			className={cn(
				"flex min-w-0 flex-col overflow-hidden rounded-lg border",
				className,
			)}
		>
			<div
				ref={sampleRef}
				style={{
					backgroundColor: `var(--${background})`,
					color: `var(--${foreground})`,
				}}
				className="flex h-28 items-end justify-between gap-2 p-4"
			>
				<span className="type-title">Aa</span>
				{info && (
					<span className="type-data rounded-md border border-current px-2 py-1">
						{info.ratio.toFixed(CONTRAST_DECIMAL_PLACES)}:1
					</span>
				)}
			</div>
			<div className="flex flex-1 flex-col gap-2 bg-background p-4">
				<span className="type-label">{name}</span>
				<code className="break-words text-muted-foreground text-xs">
					--{background} / --{foreground}
				</code>
				{info && (
					<>
						<span className="text-muted-foreground text-xs">
							{info.background} / {info.foreground}
						</span>
						<span className="type-label">
							{formatContrast(
								level,
								info.ratio < CONTRAST_AA_RATIO
									? contrastLabels.warning
									: contrastLabels.body,
							)}
						</span>
					</>
				)}
			</div>
		</div>
	);
}
