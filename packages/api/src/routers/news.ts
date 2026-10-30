import {
	INCIDENT_CATEGORIES,
	INCIDENT_SEVERITIES,
	newsArticle,
} from "@hack-the-andes-project/db/schema/scraper";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";

import {
	DEFAULT_NEWS_LIMIT_ROWS,
	DEFAULT_NEWS_RELEVANT_ONLY,
	MAX_NEWS_LIMIT_ROWS,
} from "../constants";
import { protectedProcedure } from "../index";

export const newsRouter = {
	list: protectedProcedure
		.input(
			z.object({
				limit: z
					.number()
					.int()
					.positive()
					.max(MAX_NEWS_LIMIT_ROWS)
					.default(DEFAULT_NEWS_LIMIT_ROWS),
				relevantOnly: z.boolean().default(DEFAULT_NEWS_RELEVANT_ONLY),
			}),
		)
		.output(
			z.array(
				z.object({
					id: z.string(),
					url: z.string(),
					title: z.string(),
					excerpt: z.string().nullable(),
					section: z.string().nullable(),
					publishedAt: z.date().nullable(),
					relevant: z.boolean(),
					relevance: z.number(),
					category: z.enum(INCIDENT_CATEGORIES).nullable(),
					severity: z.enum(INCIDENT_SEVERITIES).nullable(),
					region: z.string().nullable(),
				}),
			),
		)
		.handler(async ({ context, input }) => {
			const articles = await context.db
				.select({
					id: newsArticle.id,
					url: newsArticle.url,
					title: newsArticle.title,
					excerpt: newsArticle.excerpt,
					section: newsArticle.section,
					publishedAt: newsArticle.publishedAt,
					relevant: newsArticle.relevant,
					relevance: newsArticle.relevance,
					category: newsArticle.category,
					severity: newsArticle.severity,
					region: newsArticle.region,
				})
				.from(newsArticle)
				.where(
					input.relevantOnly
						? eq(newsArticle.relevant, input.relevantOnly)
						: undefined,
				)
				.orderBy(desc(newsArticle.publishedAt))
				.limit(input.limit);

			context.log.set({
				news: {
					count: articles.length,
					limit: input.limit,
					relevantOnly: input.relevantOnly,
				},
			});
			return articles;
		}),
};
