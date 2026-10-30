"use client";

import { cn } from "cn";
import { type ComponentProps, useId, useMemo } from "react";

import {
	CONTOUR_RANDOM_INCREMENT,
	CONTOUR_RANDOM_MULTIPLIER,
	CONTOUR_RANDOM_RANGE,
	MAYU_BEZIER_DEGREE,
	MAYU_COORDINATE_PRECISION,
	MAYU_CURVE_CONTROL_END_PX,
	MAYU_CURVE_CONTROL_START_PX,
	MAYU_CURVE_END_PX,
	MAYU_CURVE_START_PX,
	MAYU_DEFAULT_SEED,
	MAYU_DISTRIBUTION_CENTER,
	MAYU_GLOW_BLUR_PX,
	MAYU_GLOW_FILTER_BOUNDS,
	MAYU_GLOW_OPACITY,
	MAYU_GLOW_WIDTH_PX,
	MAYU_HEIGHT_PX,
	MAYU_RAIN_COUNT,
	MAYU_RAIN_HORIZONTAL_SLOPE,
	MAYU_RAIN_LENGTH_MIN_PX,
	MAYU_RAIN_LENGTH_RANGE_PX,
	MAYU_RAIN_OPACITY_GROUP_COUNT,
	MAYU_RAIN_OPACITY_MIN,
	MAYU_RAIN_OPACITY_STEP,
	MAYU_RAIN_STROKE_WIDTH_PX,
	MAYU_STAR_COUNT,
	MAYU_STAR_HORIZONTAL_SPREAD_PX,
	MAYU_STAR_OPACITY_MIN,
	MAYU_STAR_OPACITY_RANGE,
	MAYU_STAR_RADIUS_MIN_PX,
	MAYU_STAR_RADIUS_RANGE_PX,
	MAYU_STAR_VERTICAL_SPREAD_PX,
	MAYU_WIDTH_PX,
} from "../lib/constants";

interface MayuArtProps extends Omit<ComponentProps<"svg">, "children"> {
	seed?: number;
}

function createRandom(seed: number) {
	let randomState = seed >>> 0;
	return () => {
		randomState =
			(Math.imul(randomState, CONTOUR_RANDOM_MULTIPLIER) +
				CONTOUR_RANDOM_INCREMENT) >>>
			0;
		return randomState / CONTOUR_RANDOM_RANGE;
	};
}

export function StarRiver({
	className,
	seed = MAYU_DEFAULT_SEED,
	...props
}: MayuArtProps) {
	const glowId = useId();
	const stars = useMemo(() => {
		const random = createRandom(seed);
		return Array.from({ length: MAYU_STAR_COUNT }, (_, starIndex) => {
			const progress = random();
			const remaining = 1 - progress;
			const startWeight = remaining ** MAYU_BEZIER_DEGREE;
			const controlStartWeight =
				MAYU_BEZIER_DEGREE * remaining * remaining * progress;
			const controlEndWeight =
				MAYU_BEZIER_DEGREE * remaining * progress * progress;
			const endWeight = progress ** MAYU_BEZIER_DEGREE;
			const horizontal =
				startWeight * MAYU_CURVE_START_PX.horizontal +
				controlStartWeight * MAYU_CURVE_CONTROL_START_PX.horizontal +
				controlEndWeight * MAYU_CURVE_CONTROL_END_PX.horizontal +
				endWeight * MAYU_CURVE_END_PX.horizontal +
				(random() + random() + random() - MAYU_DISTRIBUTION_CENTER) *
					MAYU_STAR_HORIZONTAL_SPREAD_PX;
			const vertical =
				startWeight * MAYU_CURVE_START_PX.vertical +
				controlStartWeight * MAYU_CURVE_CONTROL_START_PX.vertical +
				controlEndWeight * MAYU_CURVE_CONTROL_END_PX.vertical +
				endWeight * MAYU_CURVE_END_PX.vertical +
				(random() + random() + random() - MAYU_DISTRIBUTION_CENTER) *
					MAYU_STAR_VERTICAL_SPREAD_PX;
			return {
				id: starIndex,
				horizontal: horizontal.toFixed(MAYU_COORDINATE_PRECISION),
				vertical: vertical.toFixed(MAYU_COORDINATE_PRECISION),
				radius: (
					MAYU_STAR_RADIUS_MIN_PX +
					random() * MAYU_STAR_RADIUS_RANGE_PX
				).toFixed(MAYU_COORDINATE_PRECISION),
				opacity: (
					MAYU_STAR_OPACITY_MIN +
					random() * MAYU_STAR_OPACITY_RANGE
				).toFixed(MAYU_COORDINATE_PRECISION),
			};
		});
	}, [seed]);

	return (
		<svg
			viewBox={`0 0 ${MAYU_WIDTH_PX} ${MAYU_HEIGHT_PX}`}
			preserveAspectRatio="xMidYMid slice"
			{...props}
			className={cn(
				"pointer-events-none absolute inset-0 size-full",
				className,
			)}
			aria-hidden="true"
			focusable="false"
		>
			<defs>
				<filter
					id={glowId}
					x={MAYU_GLOW_FILTER_BOUNDS.start}
					y={MAYU_GLOW_FILTER_BOUNDS.start}
					width={MAYU_GLOW_FILTER_BOUNDS.extent}
					height={MAYU_GLOW_FILTER_BOUNDS.extent}
				>
					<feGaussianBlur stdDeviation={MAYU_GLOW_BLUR_PX} />
				</filter>
			</defs>
			<path
				d={`M${MAYU_CURVE_START_PX.horizontal},${MAYU_CURVE_START_PX.vertical}C${MAYU_CURVE_CONTROL_START_PX.horizontal},${MAYU_CURVE_CONTROL_START_PX.vertical} ${MAYU_CURVE_CONTROL_END_PX.horizontal},${MAYU_CURVE_CONTROL_END_PX.vertical} ${MAYU_CURVE_END_PX.horizontal},${MAYU_CURVE_END_PX.vertical}`}
				fill="none"
				className="stroke-brand-river"
				strokeWidth={MAYU_GLOW_WIDTH_PX}
				opacity={MAYU_GLOW_OPACITY}
				filter={`url(#${glowId})`}
			/>
			<g className="fill-brand-starlight">
				{stars.map((star) => (
					<circle
						key={star.id}
						cx={star.horizontal}
						cy={star.vertical}
						r={star.radius}
						opacity={star.opacity}
					/>
				))}
			</g>
		</svg>
	);
}

export function RainStreaks({
	className,
	seed = MAYU_DEFAULT_SEED,
	...props
}: MayuArtProps) {
	const rainPaths = useMemo(() => {
		const random = createRandom(seed);
		const paths = Array.from(
			{ length: MAYU_RAIN_OPACITY_GROUP_COUNT },
			(_, groupIndex) => ({
				opacity: MAYU_RAIN_OPACITY_MIN + groupIndex * MAYU_RAIN_OPACITY_STEP,
				path: "",
			}),
		);
		for (let streakIndex = 0; streakIndex < MAYU_RAIN_COUNT; streakIndex++) {
			const horizontal = random() * MAYU_WIDTH_PX;
			const vertical = random() * MAYU_HEIGHT_PX;
			const length =
				MAYU_RAIN_LENGTH_MIN_PX + random() * MAYU_RAIN_LENGTH_RANGE_PX;
			const group = paths[streakIndex % MAYU_RAIN_OPACITY_GROUP_COUNT];
			if (group)
				group.path += `M${horizontal.toFixed(MAYU_COORDINATE_PRECISION)},${vertical.toFixed(MAYU_COORDINATE_PRECISION)}l${(length * MAYU_RAIN_HORIZONTAL_SLOPE).toFixed(MAYU_COORDINATE_PRECISION)},${length.toFixed(MAYU_COORDINATE_PRECISION)}`;
		}
		return paths;
	}, [seed]);

	return (
		<svg
			viewBox={`0 0 ${MAYU_WIDTH_PX} ${MAYU_HEIGHT_PX}`}
			preserveAspectRatio="xMidYMid slice"
			{...props}
			className={cn(
				"pointer-events-none absolute inset-0 size-full",
				className,
			)}
			aria-hidden="true"
			focusable="false"
			fill="none"
			stroke="currentColor"
			strokeWidth={MAYU_RAIN_STROKE_WIDTH_PX}
			strokeLinecap="round"
		>
			{rainPaths.map((rain) => (
				<path
					key={rain.opacity}
					d={rain.path}
					opacity={rain.opacity}
					vectorEffect="non-scaling-stroke"
				/>
			))}
		</svg>
	);
}
