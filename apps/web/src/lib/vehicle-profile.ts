import type { ProfiledVehicleSummary } from "@hack-the-andes-project/api/route-review-schemas";
import type { VehicleTypeId } from "@hack-the-andes-project/business/route-review/vehicle-types";
import type {
	FleetRouteVehicle,
	VehicleProfileDialogLabels,
	VehicleProfileDraft,
} from "@hack-the-andes-project/ui/lib/fleet";
import { vehicleTypeShortLabel } from "@hack-the-andes-project/ui/lib/route-review";
import {
	type UseMutationResult,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
	invalidateRouteReviewQueries,
	routeReviewClient,
} from "@/lib/route-review-queries";
import { m } from "@/paraglide/messages";

export function getVehicleTypeLabels(): Record<VehicleTypeId, string> {
	return {
		pickup: m.vehicle_type_pickup(),
		c2: m.vehicle_type_c2(),
		c3: m.vehicle_type_c3(),
		b3: m.vehicle_type_b3(),
		t2s3: m.vehicle_type_t2s3(),
		t3s3: m.vehicle_type_t3s3(),
		other: m.vehicle_type_other(),
	};
}

export function getVehicleProfileDialogLabels(): VehicleProfileDialogLabels {
	return {
		createTitle: m.add_vehicle(),
		setTypeTitle: m.vehicle_dialog_set_type_title(),
		createDescription: m.vehicle_dialog_create_description(),
		setTypeDescription: m.vehicle_dialog_set_type_description(),
		name: m.vehicle_dialog_name(),
		plate: m.vehicle_dialog_plate(),
		optionalPlate: m.vehicle_dialog_optional_plate(),
		origin: m.vehicle_dialog_origin(),
		providerDescription: (provider) =>
			m.vehicle_dialog_provider_description({ provider }),
		manual: m.vehicle_dialog_manual(),
		vehicleType: m.vehicle_dialog_vehicle_type(),
		axles: m.vehicle_dialog_axles(),
		weight: m.vehicle_dialog_weight(),
		optionalWeight: m.vehicle_dialog_optional_weight(),
		otherHint: m.vehicle_dialog_other_hint(),
		axleHint: m.vehicle_dialog_axle_hint(),
		typeHint: (type) => m.vehicle_dialog_type_hint({ type }),
		typeDetails: (axles, tonnes) =>
			m.vehicle_dialog_type_details({ axles, tonnes }),
		nameRequired: m.vehicle_dialog_name_required(),
		typeRequired: m.vehicle_dialog_type_required(),
		axlesInvalid: m.vehicle_dialog_axles_invalid(),
		weightInvalid: m.vehicle_dialog_weight_invalid(),
		errorTitle: m.vehicle_dialog_error_title(),
		errorDescription: m.vehicle_dialog_error_description(),
		cancel: m.vehicle_dialog_cancel(),
		create: m.add_vehicle(),
		saveType: m.vehicle_dialog_save_type(),
		saving: m.saving(),
	};
}

export interface UseSaveVehicleProfileOptions {
	vehicle: FleetRouteVehicle | null;
	onSaved?: (vehicle: ProfiledVehicleSummary) => void | Promise<void>;
}

export function useSaveVehicleProfile({
	vehicle,
	onSaved,
}: UseSaveVehicleProfileOptions): UseMutationResult<
	ProfiledVehicleSummary,
	Error,
	VehicleProfileDraft
> {
	const queryClient = useQueryClient();
	const navigate = useNavigate();
	const vehicleTypeLabels = getVehicleTypeLabels();
	return useMutation({
		mutationFn: (draft: VehicleProfileDraft) =>
			vehicle
				? routeReviewClient.vehicles.updateProfile({
						id: vehicle.id,
						vehicleTypeId: draft.vehicleTypeId,
						axleCount: draft.axleCount,
						grossWeightKg: draft.grossWeightKg,
					})
				: routeReviewClient.vehicles.create(draft),
		onSuccess: async (savedVehicle) => {
			await invalidateRouteReviewQueries(queryClient);
			toast.success(
				vehicle && savedVehicle.profile
					? m.fleet_type_saved({
							name: savedVehicle.name,
							type: vehicleTypeShortLabel(
								savedVehicle.profile.vehicleTypeId,
								vehicleTypeLabels,
							),
							axles: savedVehicle.profile.axleCount,
						})
					: m.fleet_created({ name: savedVehicle.name }),
				{
					action: {
						label: m.plan_trip(),
						onClick: () => {
							void navigate({
								to: "/dashboard/revisar-ruta",
								search: { vehiculo: savedVehicle.id },
							});
						},
					},
				},
			);
			await onSaved?.(savedVehicle);
		},
	});
}
