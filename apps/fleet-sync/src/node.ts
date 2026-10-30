import { FLEET_SYNC_CRON } from "@iathon-kiro/infra/constants";
import {
	scheduleWorker,
	serveWorker,
} from "@iathon-kiro/node-runtime/serve";

import worker from "./index";

serveWorker({ worker });
scheduleWorker({ worker, crons: [FLEET_SYNC_CRON] });
