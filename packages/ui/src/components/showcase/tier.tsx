import type { ReactNode } from "react";

interface ShowcaseTierProps {
	id: string;
	title: string;
	description: string;
	children: ReactNode;
}

export function ShowcaseTier({
	id,
	title,
	description,
	children,
}: ShowcaseTierProps) {
	return (
		<section
			id={id}
			aria-labelledby={`${id}-title`}
			className="flex min-w-0 scroll-mt-8 flex-col gap-8"
		>
			<header className="flex flex-col gap-3">
				<h3 id={`${id}-title`} className="type-heading">
					{title}
				</h3>
				<p className="type-body max-w-3xl text-muted-foreground">
					{description}
				</p>
			</header>
			{children}
		</section>
	);
}
