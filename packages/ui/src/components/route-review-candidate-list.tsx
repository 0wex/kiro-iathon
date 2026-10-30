import { compareRouteCandidates } from "@hack-the-andes-project/business/route-review/ranking";
import type { RouteRiskHorizon } from "@hack-the-andes-project/business/route-review/risk";
import { type ReactNode, useId } from "react";
import type {
	RouteReviewCandidate,
	RouteReviewLabels,
} from "../lib/route-review";
import { RouteReviewCandidateCard } from "./route-review-candidate-card";

interface RouteReviewCandidateListProps {
	candidates: RouteReviewCandidate[];
	recommendedCandidateId: string | null;
	chosenCandidateId?: string;
	vehicleAxleCount: number;
	horizon: RouteRiskHorizon;
	selectedCandidateId: string | null;
	onSelect: (id: string) => void;
	onViewMap?: (id: string) => void;
	renderAction: (candidate: RouteReviewCandidate) => ReactNode;
	isBusy: boolean;
	labels: RouteReviewLabels;
}
export function RouteReviewCandidateList({
	candidates,
	recommendedCandidateId,
	chosenCandidateId,
	vehicleAxleCount,
	horizon,
	selectedCandidateId,
	onSelect,
	onViewMap,
	renderAction,
	isBusy,
	labels,
}: RouteReviewCandidateListProps) {
	const sectionId = useId();
	const sorted = candidates.toSorted(compareRouteCandidates);
	const recommended = sorted.find(
		(candidate) =>
			candidate.id === recommendedCandidateId && candidate.eligibility.eligible,
	);
	const groups = [
		{
			id: "recommended",
			label: labels.recommended,
			candidates: recommended ? [recommended] : [],
		},
		{
			id: "illapa",
			label: labels.illapaGroup,
			candidates: sorted.filter(
				(candidate) =>
					candidate.source === "illapa" && candidate.id !== recommended?.id,
			),
		},
		{
			id: "sutran",
			label: labels.sutranGroup,
			candidates: sorted.filter(
				(candidate) =>
					candidate.source === "sutran" && candidate.id !== recommended?.id,
			),
		},
	];
	return (
		<div aria-busy={isBusy} className="flex flex-col gap-5">
			{groups
				.filter((group) => group.candidates.length)
				.map((group) => (
					<section
						key={group.id}
						aria-labelledby={`${sectionId}-${group.id}`}
						className="flex flex-col gap-3"
					>
						<h3 id={`${sectionId}-${group.id}`} className="type-label">
							{group.label}
						</h3>
						<ul className="flex flex-col gap-3">
							{group.candidates.map((candidate) => (
								<li key={candidate.id}>
									<RouteReviewCandidateCard
										candidate={candidate}
										horizon={horizon}
										vehicleAxleCount={vehicleAxleCount}
										isSelected={selectedCandidateId === candidate.id}
										isRecommended={candidate.id === recommended?.id}
										isChosen={chosenCandidateId === candidate.id}
										onSelect={() => onSelect(candidate.id)}
										onViewMap={
											onViewMap ? () => onViewMap(candidate.id) : undefined
										}
										action={
											candidate.id === selectedCandidateId &&
											candidate.eligibility.eligible
												? renderAction(candidate)
												: null
										}
										rerouteName={
											recommended?.id !== candidate.id
												? recommended?.name
												: undefined
										}
										labels={labels}
									/>
								</li>
							))}
						</ul>
					</section>
				))}
		</div>
	);
}
