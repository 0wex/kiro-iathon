import type { Incident } from "@hack-the-andes-project/ui/lib/incident";
import { INCIDENT_CATEGORY_LABELS } from "@hack-the-andes-project/ui/lib/incident-constants";
import { ExternalLinkIcon } from "lucide-react";

import { Badge } from "./badge";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./card";
import { DateTime } from "./date-time";
import { SeverityBadge } from "./severity";

export interface NewsArticle {
	title: string;
	url: string;
	excerpt: string | null;
	severity: Incident["severity"] | null;
	category: Incident["category"] | null;
	region: string | null;
	publishedAt: Date | null;
	relevant: boolean;
}

export interface NewsArticleCardProps {
	article: NewsArticle;
}

export function NewsArticleCard({ article }: NewsArticleCardProps) {
	return (
		<Card className="h-full">
			<CardHeader className="gap-3">
				<div className="flex flex-wrap items-center gap-2">
					{article.severity && <SeverityBadge severity={article.severity} />}
					{article.category && (
						<Badge variant="secondary">
							{INCIDENT_CATEGORY_LABELS[article.category]}
						</Badge>
					)}
					{!article.relevant && (
						<Badge variant="outline">Contexto general</Badge>
					)}
				</div>
				<CardTitle>
					<h2>
						<a
							href={article.url}
							target="_blank"
							rel="noopener noreferrer"
							className="group flex items-start justify-between gap-3 outline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-ring"
						>
							{article.title}
							<ExternalLinkIcon
								aria-hidden="true"
								className="mt-0.5 size-4 shrink-0 text-muted-foreground"
							/>
							<span className="sr-only">(abre en otra pestaña)</span>
						</a>
					</h2>
				</CardTitle>
			</CardHeader>
			<CardContent className="flex-1">
				<p className="type-body text-muted-foreground">
					{article.excerpt ??
						"Abre la noticia para leer la información completa en la fuente."}
				</p>
			</CardContent>
			<CardFooter className="flex-wrap justify-between gap-2 text-muted-foreground">
				<span className="type-label">{article.region ?? "Perú"}</span>
				{article.publishedAt ? (
					<DateTime value={article.publishedAt} />
				) : (
					<span className="type-data">Fecha no disponible</span>
				)}
			</CardFooter>
		</Card>
	);
}
