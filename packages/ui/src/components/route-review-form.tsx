import type { RouteReviewPlaceId } from "@hack-the-andes-project/business/route-review/places";
import { cn } from "cn";
import { ArrowLeftRightIcon } from "lucide-react";
import { useId, useState } from "react";
import type {
	RouteReviewFormValue,
	RouteReviewLabels,
	RouteReviewVehicleOption,
} from "../lib/route-review";
import { Alert, AlertDescription } from "./alert";
import { Button } from "./button";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "./combobox";
import { Field, FieldError, FieldGroup, FieldLabel } from "./field";
import { PlusIcon, TriangleAlertIcon } from "./icons";
import { Input } from "./input";
import { Spinner } from "./spinner";

interface PlaceOption {
	id: RouteReviewPlaceId;
	name: string;
}
interface RouteReviewFormProps {
	places: PlaceOption[];
	vehicles: RouteReviewVehicleOption[];
	value: RouteReviewFormValue;
	onValueChange: (value: RouteReviewFormValue) => void;
	onSubmit: () => void;
	onAddVehicle: () => void;
	onSetVehicleType: () => void;
	departureWindow: { min: string; max: string };
	isReviewing: boolean;
	isDisabled: boolean;
	error: { destination?: string; departure?: string; vehicle?: string };
	collapsed: boolean;
	onExpand: () => void;
	labels: RouteReviewLabels;
	summary: string;
	vehicleInputId: string;
}
export function RouteReviewForm({
	places,
	vehicles,
	value,
	onValueChange,
	onSubmit,
	onAddVehicle,
	onSetVehicleType,
	departureWindow,
	isReviewing,
	isDisabled,
	error,
	collapsed,
	onExpand,
	labels,
	summary,
	vehicleInputId,
}: RouteReviewFormProps) {
	const formId = useId();
	const [vehicleOpen, setVehicleOpen] = useState(false);
	const selectedVehicle = vehicles.find(
		(vehicle) => vehicle.id === value.vehicleId,
	);
	return (
		<div>
			{collapsed ? (
				<div className="flex items-center justify-between gap-2 p-4 xl:hidden">
					<p className="text-sm">{summary}</p>
					<Button variant="outline" className="min-h-11" onClick={onExpand}>
						{labels.edit}
					</Button>
				</div>
			) : null}
			<form
				className={cn("p-4", collapsed && "hidden xl:block")}
				noValidate
				onSubmit={(event) => {
					event.preventDefault();
					onSubmit();
				}}
			>
				<fieldset disabled={isDisabled} className="min-w-0">
					<FieldGroup>
						<div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
							<Field>
								<FieldLabel htmlFor={`${formId}-origin`}>
									{labels.origin}
								</FieldLabel>
								<Combobox
									items={places}
									value={
										places.find((place) => place.id === value.originPlaceId) ??
										null
									}
									itemToStringLabel={(place) => place.name}
									onValueChange={(place) => {
										if (place)
											onValueChange({ ...value, originPlaceId: place.id });
									}}
									disabled={isDisabled}
								>
									<ComboboxInput
										id={`${formId}-origin`}
										showTrigger={false}
										className="h-11 w-full"
									/>
									<ComboboxContent>
										<ComboboxEmpty>{labels.noMatches}</ComboboxEmpty>
										<ComboboxList>
											{(place: PlaceOption) => (
												<ComboboxItem
													key={place.id}
													value={place}
													className="min-h-11"
												>
													{place.name}
												</ComboboxItem>
											)}
										</ComboboxList>
									</ComboboxContent>
								</Combobox>
							</Field>
							<Button
								type="button"
								variant="ghost"
								className="mt-6 min-h-11 min-w-11"
								aria-label={labels.swap}
								onClick={() =>
									onValueChange({
										...value,
										originPlaceId: value.destinationPlaceId,
										destinationPlaceId: value.originPlaceId,
									})
								}
							>
								<ArrowLeftRightIcon />
							</Button>
							<Field data-invalid={Boolean(error.destination)}>
								<FieldLabel htmlFor={`${formId}-destination`}>
									{labels.destination}
								</FieldLabel>
								<Combobox
									items={places}
									value={
										places.find(
											(place) => place.id === value.destinationPlaceId,
										) ?? null
									}
									itemToStringLabel={(place) => place.name}
									onValueChange={(place) => {
										if (place)
											onValueChange({ ...value, destinationPlaceId: place.id });
									}}
									disabled={isDisabled}
								>
									<ComboboxInput
										id={`${formId}-destination`}
										showTrigger={false}
										className="h-11 w-full"
										aria-invalid={Boolean(error.destination)}
										aria-describedby={
											error.destination
												? `${formId}-destination-error`
												: undefined
										}
									/>
									<ComboboxContent>
										<ComboboxEmpty>{labels.noMatches}</ComboboxEmpty>
										<ComboboxList>
											{(place: PlaceOption) => (
												<ComboboxItem
													key={place.id}
													value={place}
													className="min-h-11"
												>
													{place.name}
												</ComboboxItem>
											)}
										</ComboboxList>
									</ComboboxContent>
								</Combobox>
								{error.destination ? (
									<FieldError id={`${formId}-destination-error`}>
										{error.destination}
									</FieldError>
								) : null}
							</Field>
						</div>
						<Field data-invalid={Boolean(error.vehicle)}>
							<FieldLabel htmlFor={vehicleInputId}>{labels.vehicle}</FieldLabel>
							<Combobox
								items={vehicles}
								value={selectedVehicle ?? null}
								open={vehicleOpen}
								onOpenChange={setVehicleOpen}
								disabled={isDisabled}
								itemToStringLabel={(vehicle) =>
									[
										vehicle.name,
										vehicle.plate,
										vehicle.typeLabel,
										vehicle.axleCount
											? labels.axles(vehicle.axleCount)
											: labels.noType,
									]
										.filter(Boolean)
										.join(" · ")
								}
								onValueChange={(vehicle) =>
									onValueChange({ ...value, vehicleId: vehicle?.id ?? "" })
								}
							>
								<ComboboxInput
									id={vehicleInputId}
									showTrigger={false}
									className="h-11 w-full"
									placeholder={labels.chooseVehicle}
									aria-invalid={Boolean(error.vehicle)}
									aria-describedby={
										selectedVehicle?.typeLabel === null || error.vehicle
											? `${formId}-vehicle-warning`
											: undefined
									}
								/>
								<ComboboxContent>
									<ComboboxEmpty>{labels.noMatches}</ComboboxEmpty>
									<ComboboxList>
										{(vehicle: RouteReviewVehicleOption) => (
											<ComboboxItem
												key={vehicle.id}
												value={vehicle}
												className="min-h-11 flex-wrap"
											>
												<span>
													{vehicle.name}
													{vehicle.plate ? ` · ${vehicle.plate}` : ""}
												</span>
												<span className="text-muted-foreground">
													{vehicle.typeLabel
														? `${vehicle.typeLabel} · ${labels.axles(vehicle.axleCount ?? 0)}`
														: labels.noType}
												</span>
											</ComboboxItem>
										)}
									</ComboboxList>
									<Button
										type="button"
										variant="ghost"
										className="min-h-11 w-full justify-start"
										onClick={() => {
											setVehicleOpen(false);
											onAddVehicle();
										}}
									>
										<PlusIcon data-icon="inline-start" />
										{labels.addVehicle}
									</Button>
								</ComboboxContent>
							</Combobox>
							{selectedVehicle?.typeLabel === null || error.vehicle ? (
								<Alert id={`${formId}-vehicle-warning`}>
									<TriangleAlertIcon />
									<AlertDescription>
										{error.vehicle || labels.missingType}
										<Button
											type="button"
											variant="outline"
											className="min-h-11"
											onClick={onSetVehicleType}
										>
											{labels.setVehicleType}
										</Button>
									</AlertDescription>
								</Alert>
							) : null}
						</Field>
						<Field data-invalid={Boolean(error.departure)}>
							<FieldLabel htmlFor={`${formId}-departure`}>
								{labels.departure}
							</FieldLabel>
							<Input
								id={`${formId}-departure`}
								className="h-11"
								type="datetime-local"
								value={value.departureLocal}
								min={departureWindow.min}
								max={departureWindow.max}
								aria-invalid={Boolean(error.departure)}
								aria-describedby={
									error.departure ? `${formId}-departure-error` : undefined
								}
								onChange={(event) =>
									onValueChange({
										...value,
										departureLocal: event.target.value,
									})
								}
							/>
							{error.departure ? (
								<FieldError id={`${formId}-departure-error`}>
									{error.departure}
								</FieldError>
							) : null}
						</Field>
						<Button
							type="submit"
							className="min-h-11"
							disabled={isDisabled || !selectedVehicle?.typeLabel}
						>
							{isReviewing ? <Spinner data-icon="inline-start" /> : null}
							{isReviewing ? labels.reviewing : labels.review}
						</Button>
					</FieldGroup>
				</fieldset>
			</form>
		</div>
	);
}
