import { cn } from "cn";

export interface IllapaMarkProps {
	className?: string;
	title?: string;
}

export interface IllapaLockupProps {
	className?: string;
	markClassName?: string;
	wordmarkClassName?: string;
}

export function IllapaMark({ className, title }: IllapaMarkProps) {
	return (
		<svg
			viewBox="0 0 64 64"
			className={cn("size-8 shrink-0", className)}
			role={title ? "img" : undefined}
			aria-label={title}
			aria-hidden={title ? undefined : true}
			focusable="false"
		>
			{title && <title>{title}</title>}
			<path
				d="M32 5C32 5 13 27.5 13 40.5C13 51 21.5 59 32 59C42.5 59 51 51 51 40.5C51 27.5 32 5 32 5Z"
				className="fill-brand-river"
			/>
			<path
				d="M35.6 20.5L24.4 39.6H31.4L27.8 53.4L40.6 33.4H33.6L37.8 20.5Z"
				className="fill-brand-starlight stroke-brand-starlight"
				strokeWidth="0.8"
				strokeLinejoin="round"
			/>
		</svg>
	);
}

export function IllapaLockup({
	className,
	markClassName,
	wordmarkClassName,
}: IllapaLockupProps) {
	return (
		<span
			className={cn(
				"inline-flex shrink-0 items-center gap-2 text-foreground",
				className,
			)}
		>
			<IllapaMark className={cn("size-6", markClassName)} />
			<span
				className={cn(
					"font-extrabold font-heading font-stretch-expanded text-2xl normal-case leading-none tracking-[-0.01em]",
					wordmarkClassName,
				)}
			>
				illapa
			</span>
		</span>
	);
}
