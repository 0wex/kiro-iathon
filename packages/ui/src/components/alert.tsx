import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import {
	CircleCheckIcon,
	InfoIcon,
	OctagonXIcon,
	TriangleAlertIcon,
} from "lucide-react";
import type * as React from "react";

const alertVariants = cva(
	"group/alert relative flex w-full items-start gap-3 rounded-lg border px-4 py-3 text-left has-data-[slot=alert-action]:pr-18 *:[svg:not([class*='size-'])]:size-4 *:[svg]:mt-0.5 *:[svg]:shrink-0",
	{
		variants: {
			variant: {
				default: "border-border bg-card text-card-foreground",
				destructive:
					"border-destructive/25 bg-destructive/8 text-card-foreground *:[svg]:text-destructive",
				low: "border-risk-low/25 bg-risk-low/8 text-card-foreground *:[svg]:text-risk-low",
				moderate:
					"border-risk-moderate/35 bg-risk-moderate/12 text-card-foreground *:[svg]:text-risk-moderate",
				high: "border-risk-high/30 bg-risk-high/10 text-card-foreground *:[svg]:text-risk-high",
				critical:
					"border-risk-critical/25 bg-risk-critical/8 text-card-foreground *:[svg]:text-risk-critical",
				info: "border-info/25 bg-info/8 text-card-foreground *:[svg]:text-info",
				success:
					"border-success/25 bg-success/8 text-card-foreground *:[svg]:text-success",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	},
);

const alertVariantIcons = {
	default: null,
	destructive: <OctagonXIcon aria-hidden="true" />,
	critical: <OctagonXIcon aria-hidden="true" />,
	high: <TriangleAlertIcon aria-hidden="true" />,
	moderate: <TriangleAlertIcon aria-hidden="true" />,
	low: <InfoIcon aria-hidden="true" />,
	info: <InfoIcon aria-hidden="true" />,
	success: <CircleCheckIcon aria-hidden="true" />,
};

function Alert({
	className,
	variant = "default",
	children,
	...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
	return (
		<div
			data-slot="alert"
			role="alert"
			className={cn(alertVariants({ variant }), className)}
			{...props}
		>
			{alertVariantIcons[variant ?? "default"]}
			<div className="flex min-w-0 flex-1 flex-col gap-0.5">{children}</div>
		</div>
	);
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-title"
			className={cn(
				"font-sans font-semibold text-sm/5 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground",
				className,
			)}
			{...props}
		/>
	);
}

function AlertDescription({
	className,
	...props
}: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-description"
			className={cn(
				"text-pretty text-muted-foreground text-sm/5 [&_a]:underline [&_a]:underline-offset-3 [&_a]:hover:text-foreground [&_p:not(:last-child)]:mb-1",
				className,
			)}
			{...props}
		/>
	);
}

function AlertAction({ className, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="alert-action"
			className={cn("absolute top-2.5 right-2.5", className)}
			{...props}
		/>
	);
}

export { Alert, AlertAction, AlertDescription, AlertTitle };
