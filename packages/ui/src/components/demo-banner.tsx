import { Button } from "./button";
import { Spinner } from "./spinner";

export interface DemoBannerProps {
	message: string;
	actionLabel: string;
	pendingLabel: string;
	isPending: boolean;
	errorMessage?: string;
	onCreateAccount: () => void;
}

export function DemoBanner({
	message,
	actionLabel,
	pendingLabel,
	isPending,
	errorMessage,
	onCreateAccount,
}: DemoBannerProps) {
	return (
		<aside
			aria-label={message}
			className="flex shrink-0 flex-col border-info/20 border-b bg-info/10 px-4 text-info"
		>
			<div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
				<p className="type-body">{message}</p>
				<Button
					variant="ghost"
					className="min-h-11 text-info hover:bg-info/10 hover:text-info focus-visible:border-info focus-visible:ring-info"
					disabled={isPending}
					onClick={onCreateAccount}
				>
					{isPending ? (
						<Spinner aria-hidden="true" data-icon="inline-start" />
					) : null}
					{isPending ? pendingLabel : actionLabel}
				</Button>
			</div>
			{errorMessage ? (
				<p role="alert" className="type-body pb-2">
					{errorMessage}
				</p>
			) : null}
		</aside>
	);
}
