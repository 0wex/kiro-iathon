CREATE INDEX `alert_status_idx` ON `iathon_kiro_alert` (`status`);--> statement-breakpoint
CREATE INDEX `trip_status_vehicleId_idx` ON `iathon_kiro_trip` (`status`,`vehicle_id`);--> statement-breakpoint
CREATE INDEX `trip_reviewId_idx` ON `iathon_kiro_trip` (`review_id`);--> statement-breakpoint
CREATE INDEX `newsArticle_publishedAt_idx` ON `iathon_kiro_news_article` (`published_at`);