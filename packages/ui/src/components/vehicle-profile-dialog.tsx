import {
	KG_PER_TONNE,
	MAX_VEHICLE_AXLE_COUNT,
	MIN_VEHICLE_AXLE_COUNT,
	VEHICLE_PLATE_LENGTH_CHARS,
} from "@hack-the-andes-project/business/constants";
import { GPS_PROVIDER_LABELS } from "@hack-the-andes-project/business/providers/index";
import {
	VEHICLE_TYPE_IDS,
	VEHICLE_TYPES,
	type VehicleTypeId,
} from "@hack-the-andes-project/business/route-review/vehicle-types";
import { useId, useState } from "react";
import type {
	FleetRouteVehicle,
	VehicleProfileDialogLabels,
	VehicleProfileDraft,
} from "../lib/fleet";
import { vehicleTypeShortLabel } from "../lib/route-review";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Button } from "./button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "./field";
import { Input } from "./input";
import { RadioGroup, RadioGroupItem } from "./radio-group";
import { Spinner } from "./spinner";

export interface VehicleProfileDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	vehicle: FleetRouteVehicle | null;
	isPending: boolean;
	onSubmit: (draft: VehicleProfileDraft) => Promise<unknown>;
	labels: VehicleProfileDialogLabels;
	vehicleTypeLabels: Record<VehicleTypeId, string>;
}

export function VehicleProfileDialog(props: VehicleProfileDialogProps) {
	return (
		<Dialog
			open={props.open}
			onOpenChange={(open) => {
				if (!props.isPending) props.onOpenChange(open);
			}}
		>
			<DialogContent
				showCloseButton={false}
				className="max-h-[90svh] overflow-y-auto sm:max-w-xl"
			>
				<VehicleProfileForm key={props.vehicle?.id ?? "create"} {...props} />
			</DialogContent>
		</Dialog>
	);
}

function VehicleProfileForm({
	vehicle,
	isPending,
	onSubmit,
	onOpenChange,
	labels,
	vehicleTypeLabels,
}: VehicleProfileDialogProps) {
	const identifier = useId();
	const [name, setName] = useState(vehicle?.name ?? "");
	const [plate, setPlate] = useState(vehicle?.plate ?? "");
	const [vehicleTypeId, setVehicleTypeId] = useState<VehicleTypeId | null>(
		null,
	);
	const [axles, setAxles] = useState("");
	const [weight, setWeight] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const [error, setError] = useState<string>();
	const axleCount = Number(axles);
	const grossWeightKg = weight === "" ? null : Number(weight) * KG_PER_TONNE;
	const nameInvalid = !vehicle && !name.trim();
	const axlesInvalid =
		vehicleTypeId === "other" &&
		(!Number.isInteger(axleCount) ||
			axleCount < MIN_VEHICLE_AXLE_COUNT ||
			axleCount > MAX_VEHICLE_AXLE_COUNT);
	const weightInvalid =
		vehicleTypeId === "other" &&
		grossWeightKg !== null &&
		(!Number.isFinite(grossWeightKg) || grossWeightKg <= 0);
	return (
		<>
			<DialogHeader>
				<DialogTitle>
					{vehicle ? labels.setTypeTitle : labels.createTitle}
				</DialogTitle>
				<DialogDescription>
					{vehicle ? labels.setTypeDescription : labels.createDescription}
				</DialogDescription>
			</DialogHeader>
			<form
				noValidate
				className="flex flex-col gap-4"
				onSubmit={async (event) => {
					event.preventDefault();
					if (isPending) return;
					setSubmitted(true);
					const invalidField = nameInvalid
						? "name"
						: !vehicleTypeId
							? "type"
							: axlesInvalid
								? "axles"
								: weightInvalid
									? "weight"
									: null;
					if (invalidField || !vehicleTypeId) {
						document.getElementById(`${identifier}-${invalidField}`)?.focus();
						return;
					}
					setError(undefined);
					try {
						await onSubmit({
							name: vehicle?.name ?? name.trim(),
							plate: plate || null,
							vehicleTypeId,
							axleCount,
							grossWeightKg,
						});
						onOpenChange(false);
					} catch (cause) {
						setError(
							cause instanceof Error ? cause.message : labels.errorDescription,
						);
					}
				}}
			>
				<fieldset disabled={isPending} className="flex min-w-0 flex-col gap-4">
					{vehicle ? (
						<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-lg border p-3">
							<dt className="type-label">{labels.name}</dt>
							<dd className="break-words">{vehicle.name}</dd>
							<dt className="type-label">{labels.plate}</dt>
							<dd className="type-data">{vehicle.plate ?? "—"}</dd>
							<dt className="type-label">{labels.origin}</dt>
							<dd>
								{vehicle.provider
									? labels.providerDescription(
											GPS_PROVIDER_LABELS[vehicle.provider],
										)
									: labels.manual}
							</dd>
						</dl>
					) : (
						<>
							<Field data-invalid={submitted && nameInvalid}>
								<FieldLabel htmlFor={`${identifier}-name`}>
									{labels.name}
								</FieldLabel>
								<Input
									id={`${identifier}-name`}
									autoComplete="off"
									className="min-h-11"
									value={name}
									onChange={(event) => setName(event.target.value)}
									aria-invalid={submitted && nameInvalid}
									aria-describedby={
										submitted && nameInvalid
											? `${identifier}-name-error`
											: undefined
									}
								/>
								{submitted && nameInvalid && (
									<FieldError id={`${identifier}-name-error`}>
										{labels.nameRequired}
									</FieldError>
								)}
							</Field>
							<Field>
								<FieldLabel htmlFor={`${identifier}-plate`}>
									{labels.optionalPlate}
								</FieldLabel>
								<Input
									id={`${identifier}-plate`}
									autoComplete="off"
									className="min-h-11"
									maxLength={VEHICLE_PLATE_LENGTH_CHARS}
									value={plate}
									onChange={(event) => setPlate(event.target.value)}
								/>
							</Field>
						</>
					)}
					<fieldset className="min-w-0 space-y-2">
						<legend
							id={`${identifier}-type-label`}
							className="mb-2 font-medium text-sm"
						>
							{labels.vehicleType}
						</legend>
						{submitted && !vehicleTypeId && (
							<FieldError id={`${identifier}-type-error`}>
								{labels.typeRequired}
							</FieldError>
						)}
						<RadioGroup
							value={vehicleTypeId}
							disabled={isPending}
							aria-labelledby={`${identifier}-type-label`}
							aria-invalid={submitted && !vehicleTypeId}
							aria-describedby={
								submitted && !vehicleTypeId
									? `${identifier}-type-error`
									: undefined
							}
							onValueChange={(value) => {
								const selectedTypeId = VEHICLE_TYPE_IDS.find(
									(typeId) => typeId === value,
								);
								if (!selectedTypeId) return;
								setVehicleTypeId(selectedTypeId);
								const selectedType = VEHICLE_TYPES[selectedTypeId];
								setAxles(
									selectedType.axleCount === null
										? ""
										: String(selectedType.axleCount),
								);
								setWeight(
									selectedType.grossWeightKg === null
										? ""
										: String(selectedType.grossWeightKg / KG_PER_TONNE),
								);
							}}
						>
							{VEHICLE_TYPE_IDS.map((typeId, index) => {
								const vehicleType = VEHICLE_TYPES[typeId];
								return (
									<FieldLabel
										key={typeId}
										htmlFor={
											index === 0
												? `${identifier}-type`
												: `${identifier}-type-${typeId}`
										}
										className="min-h-11 w-full cursor-pointer items-center rounded-md border p-3 hover:bg-muted has-data-checked:bg-accent has-data-checked:ring-1 has-data-checked:ring-ring"
									>
										<RadioGroupItem
											id={
												index === 0
													? `${identifier}-type`
													: `${identifier}-type-${typeId}`
											}
											value={typeId}
											aria-label={`${vehicleTypeLabels[typeId]} ${vehicleType.mtcCode ?? ""}`}
										/>
										<span className="flex min-w-0 flex-1 flex-wrap justify-between gap-x-3 gap-y-1">
											<span>
												{vehicleTypeLabels[typeId]} {vehicleType.mtcCode}
											</span>
											<span className="type-data text-muted-foreground">
												{vehicleType.axleCount !== null &&
												vehicleType.grossWeightKg !== null
													? labels.typeDetails(
															vehicleType.axleCount,
															vehicleType.grossWeightKg / KG_PER_TONNE,
														)
													: labels.otherHint}
											</span>
										</span>
									</FieldLabel>
								);
							})}
						</RadioGroup>
					</fieldset>
					<div className="grid grid-cols-2 gap-3">
						<Field data-invalid={submitted && axlesInvalid}>
							<FieldLabel htmlFor={`${identifier}-axles`}>
								{labels.axles}
							</FieldLabel>
							<Input
								id={`${identifier}-axles`}
								className="type-data min-h-11 read-only:bg-muted"
								inputMode="numeric"
								value={axles}
								placeholder="—"
								readOnly={vehicleTypeId !== "other"}
								onChange={(event) => setAxles(event.target.value)}
								aria-invalid={submitted && axlesInvalid}
								aria-describedby={`${identifier}-axle-hint${submitted && axlesInvalid ? ` ${identifier}-axle-error` : ""}`}
							/>
							{submitted && axlesInvalid && (
								<FieldError id={`${identifier}-axle-error`}>
									{labels.axlesInvalid}
								</FieldError>
							)}
						</Field>
						<Field data-invalid={submitted && weightInvalid}>
							<FieldLabel htmlFor={`${identifier}-weight`}>
								{vehicleTypeId === "other"
									? labels.optionalWeight
									: labels.weight}
							</FieldLabel>
							<Input
								id={`${identifier}-weight`}
								className="type-data min-h-11 read-only:bg-muted"
								inputMode="decimal"
								value={weight}
								placeholder="—"
								readOnly={vehicleTypeId !== "other"}
								onChange={(event) => setWeight(event.target.value)}
								aria-invalid={submitted && weightInvalid}
								aria-describedby={
									submitted && weightInvalid
										? `${identifier}-weight-error`
										: undefined
								}
							/>
							{submitted && weightInvalid && (
								<FieldError id={`${identifier}-weight-error`}>
									{labels.weightInvalid}
								</FieldError>
							)}
						</Field>
					</div>
					<FieldDescription id={`${identifier}-axle-hint`}>
						{vehicleTypeId && vehicleTypeId !== "other"
							? labels.typeHint(
									vehicleTypeShortLabel(vehicleTypeId, vehicleTypeLabels),
								)
							: labels.axleHint}
					</FieldDescription>
				</fieldset>
				{error && (
					<Alert variant="destructive">
						<AlertTitle>{labels.errorTitle}</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				)}
				<DialogFooter>
					<Button
						className="min-h-11"
						type="button"
						variant="outline"
						disabled={isPending}
						onClick={() => onOpenChange(false)}
					>
						{labels.cancel}
					</Button>
					<Button className="min-h-11" type="submit" disabled={isPending}>
						{isPending && <Spinner aria-hidden="true" />}
						{isPending
							? labels.saving
							: vehicle
								? labels.saveType
								: labels.create}
					</Button>
				</DialogFooter>
			</form>
		</>
	);
}
