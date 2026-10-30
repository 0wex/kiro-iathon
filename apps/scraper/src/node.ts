import {
	SCRAPER_DAILY_CRON,
	SCRAPER_FREQUENT_CRON,
	SCRAPER_HOURLY_CRON,
} from "@iathon-kiro/infra/constants";
import {
	scheduleWorker,
	serveWorker,
} from "@iathon-kiro/node-runtime/serve";

import worker from "./index";

serveWorker({ worker });
scheduleWorker({
	worker,
	crons: [SCRAPER_FREQUENT_CRON, SCRAPER_HOURLY_CRON, SCRAPER_DAILY_CRON],
});
