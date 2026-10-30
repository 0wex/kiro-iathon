import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@hack-the-andes-project/ui/components/alert";
import { Badge } from "@hack-the-andes-project/ui/components/badge";
import { Button } from "@hack-the-andes-project/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
} from "@hack-the-andes-project/ui/components/card";
import {
	Empty,
	EmptyDescription,
	EmptyHeader,
	EmptyTitle,
} from "@hack-the-andes-project/ui/components/empty";
import { Field, FieldLabel } from "@hack-the-andes-project/ui/components/field";
import { NewsArticleCard } from "@hack-the-andes-project/ui/components/news-article-card";
import { Skeleton } from "@hack-the-andes-project/ui/components/skeleton";
import { Switch } from "@hack-the-andes-project/ui/components/switch";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import {
	DEFAULT_NEWS_LIMIT_ROWS,
	NEWS_REFETCH_INTERVAL_MS,
	NEWS_SKELETON_KEYS,
} from "@/constants";
import { orpc } from "@/utils/orpc";

export const Route = createFileRoute("/_auth/dashboard/news")({
	component: NewsPage,
});

function NewsPage() {
	const [includeNonRelevant, setIncludeNonRelevant] = useState(false);
	const newsQuery = useQuery({
		...orpc.news.list.queryOptions({
			input: {
				relevantOnly: !includeNonRelevant,
				limit: DEFAULT_NEWS_LIMIT_ROWS,
			},
		}),
		refetchInterval: NEWS_REFETCH_INTERVAL_MS,
	});

	return (
		<div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-4 md:p-6">
			<div className="flex flex-wrap items-start justify-between gap-4">
				<div className="flex flex-col gap-2">
					<p className="type-title">Actualidad en ruta</p>
					<p className="type-body max-w-xl text-muted-foreground">
						Las últimas noticias sobre clima, emergencias y vías que pueden
						afectar tu operación en Perú.
					</p>
				</div>
				<Field orientation="horizontal" className="w-auto">
					<Switch
						id="include-non-relevant"
						checked={includeNonRelevant}
						onCheckedChange={setIncludeNonRelevant}
					/>
					<FieldLabel htmlFor="include-non-relevant">
						Incluir noticias no relevantes
					</FieldLabel>
				</Field>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				<Badge variant="secondary">
					{includeNonRelevant
						? "Todas las noticias"
						: "Relevantes para tu operación"}
				</Badge>
				<span className="type-data text-muted-foreground">
					Hasta {DEFAULT_NEWS_LIMIT_ROWS} noticias recientes
				</span>
			</div>
			{newsQuery.isError && (
				<Alert variant="destructive">
					<AlertTitle>No se pudieron actualizar las noticias</AlertTitle>
					<AlertDescription>
						{newsQuery.data
							? "Se muestran los últimos datos disponibles. "
							: "Verifica tu conexión. "}
						<Button variant="link" onClick={() => newsQuery.refetch()}>
							Reintentar
						</Button>
					</AlertDescription>
				</Alert>
			)}
			{newsQuery.isPending ? (
				<section
					aria-label="Cargando noticias"
					aria-busy="true"
					className="grid gap-4 md:grid-cols-2"
				>
					{NEWS_SKELETON_KEYS.map((skeletonKey) => (
						<Card key={skeletonKey}>
							<CardHeader className="gap-3">
								<Skeleton className="h-5 w-24" />
								<Skeleton className="h-5 w-full" />
								<Skeleton className="h-5 w-2/3" />
							</CardHeader>
							<CardContent className="flex flex-col gap-2">
								<Skeleton className="h-3 w-full" />
								<Skeleton className="h-3 w-full" />
								<Skeleton className="h-3 w-3/4" />
							</CardContent>
						</Card>
					))}
				</section>
			) : (
				<div className="grid gap-4 md:grid-cols-2">
					{newsQuery.data?.map((article) => (
						<article key={article.id}>
							<NewsArticleCard article={article} />
						</article>
					))}
				</div>
			)}
			{newsQuery.isSuccess && !newsQuery.data.length && (
				<Empty className="border">
					<EmptyHeader>
						<EmptyTitle>No hay noticias por ahora</EmptyTitle>
						<EmptyDescription>
							{includeNonRelevant
								? "Las nuevas publicaciones aparecerán aquí automáticamente."
								: "Prueba incluir las noticias no relevantes para ampliar la selección."}
						</EmptyDescription>
					</EmptyHeader>
				</Empty>
			)}
		</div>
	);
}
