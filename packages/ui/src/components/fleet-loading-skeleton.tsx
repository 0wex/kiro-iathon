import {
	FLEET_SKELETON_GROUP_IDS,
	FLEET_SKELETON_ROW_IDS,
} from "./fleet-constants";
import { Skeleton } from "./skeleton";

export function FleetLoadingSkeleton() {
	return (
		<>
			<Skeleton className="h-11 w-full sm:w-72" />
			{FLEET_SKELETON_GROUP_IDS.map((groupId) => (
				<div key={groupId} className="flex flex-col gap-3">
					<Skeleton className="h-8 w-56" />
					{FLEET_SKELETON_ROW_IDS.map((rowId) => (
						<Skeleton key={rowId} className="h-44 w-full md:h-24" />
					))}
				</div>
			))}
		</>
	);
}
