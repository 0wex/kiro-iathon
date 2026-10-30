import {
	type CreateCitizenReportInput,
	createCitizenReportInputSchema,
	type GeoPoint,
	PHOTO_MEDIA_TYPES,
	REPORT_DESCRIPTION_MAX_CHARS,
} from "@iathon-kiro/business/citizen-reports/index";
import { Alert, AlertDescription } from "@iathon-kiro/ui/components/alert";
import { Button } from "@iathon-kiro/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@iathon-kiro/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@iathon-kiro/ui/components/field";
import { Input } from "@iathon-kiro/ui/components/input";
import { Spinner } from "@iathon-kiro/ui/components/spinner";
import { Textarea } from "@iathon-kiro/ui/components/textarea";
import { type FormEvent, useState } from "react";

import {
	type CompressedPhoto,
	compressPhotoToJpeg,
} from "@/components/citizen-reports/compress-photo";
import {
	CITIZEN_REPORT_COORDINATE_DECIMALS,
	GEOLOCATION_TIMEOUT_MS,
} from "@/constants";
import { m } from "@/paraglide/messages";

export interface ReportFormProps {
	location: GeoPoint | null;
	onLocationChange: (location: GeoPoint) => void;
	isSubmitting: boolean;
	submitErrorMessage: string | undefined;
	onSubmit: (input: CreateCitizenReportInput) => void;
	onCancel: () => void;
}

export function ReportForm({
	location,
	onLocationChange,
	isSubmitting,
	submitErrorMessage,
	onSubmit,
	onCancel,
}: ReportFormProps) {
	const [description, setDescription] = useState("");
	const [compressedPhoto, setCompressedPhoto] = useState<CompressedPhoto>();
	const [photoErrorMessage, setPhotoErrorMessage] = useState<string>();
	const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
	const [isLocating, setIsLocating] = useState(false);
	const [geolocationErrorMessage, setGeolocationErrorMessage] =
		useState<string>();
	const [hasAttemptedSubmit, setHasAttemptedSubmit] = useState(false);

	const validation = createCitizenReportInputSchema.safeParse({
		description,
		location: location ?? undefined,
		photo: compressedPhoto?.photo,
	});
	const issueMessageFor = (field: keyof CreateCitizenReportInput) =>
		validation.error?.issues.find((issue) => issue.path[0] === field)?.message;
	const descriptionErrorMessage = hasAttemptedSubmit
		? issueMessageFor("description")
		: undefined;
	const locationErrorMessage = location
		? issueMessageFor("location")
		: hasAttemptedSubmit
			? m.citizen_reports_form_location_missing()
			: undefined;

	const handlePhotoChange = async (file: File | undefined) => {
		setCompressedPhoto(undefined);
		setPhotoErrorMessage(undefined);
		if (!file) return;
		setIsCompressingPhoto(true);
		try {
			setCompressedPhoto(await compressPhotoToJpeg(file));
		} catch (error) {
			setPhotoErrorMessage(
				error instanceof Error
					? error.message
					: m.citizen_reports_form_photo_read_error(),
			);
		} finally {
			setIsCompressingPhoto(false);
		}
	};

	const handleUseMyLocation = () => {
		setGeolocationErrorMessage(undefined);
		if (!("geolocation" in navigator)) {
			setGeolocationErrorMessage(m.citizen_reports_form_geolocation_error());
			return;
		}
		setIsLocating(true);
		navigator.geolocation.getCurrentPosition(
			(position) => {
				setIsLocating(false);
				onLocationChange({
					lon: position.coords.longitude,
					lat: position.coords.latitude,
				});
			},
			() => {
				setIsLocating(false);
				setGeolocationErrorMessage(m.citizen_reports_form_geolocation_error());
			},
			{ enableHighAccuracy: true, timeout: GEOLOCATION_TIMEOUT_MS },
		);
	};

	const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault();
		setHasAttemptedSubmit(true);
		if (validation.success && !isCompressingPhoto) onSubmit(validation.data);
	};

	return (
		<Card>
			<CardHeader>
				<CardTitle className="type-heading">
					{m.citizen_reports_form_title()}
				</CardTitle>
				<CardDescription>{m.citizen_reports_map_pick_hint()}</CardDescription>
			</CardHeader>
			<CardContent>
				<form noValidate onSubmit={handleSubmit}>
					<FieldGroup>
						<Field data-invalid={Boolean(descriptionErrorMessage)}>
							<FieldLabel htmlFor="citizen-report-description">
								{m.citizen_reports_form_description_label()}
							</FieldLabel>
							<Textarea
								id="citizen-report-description"
								value={description}
								onChange={(event) => setDescription(event.target.value)}
								placeholder={m.citizen_reports_form_description_placeholder()}
								maxLength={REPORT_DESCRIPTION_MAX_CHARS}
								rows={4}
								required
								aria-invalid={Boolean(descriptionErrorMessage)}
								aria-describedby="citizen-report-description-count"
							/>
							<FieldDescription
								id="citizen-report-description-count"
								className="type-data"
							>
								{m.citizen_reports_form_character_count({
									count: String(description.trim().length),
									max: String(REPORT_DESCRIPTION_MAX_CHARS),
								})}
							</FieldDescription>
							<FieldError>{descriptionErrorMessage}</FieldError>
						</Field>
						<Field data-invalid={Boolean(photoErrorMessage)}>
							<FieldLabel htmlFor="citizen-report-photo">
								{m.citizen_reports_form_photo_label()}
							</FieldLabel>
							<Input
								id="citizen-report-photo"
								type="file"
								accept={PHOTO_MEDIA_TYPES.join(",")}
								capture="environment"
								disabled={isCompressingPhoto}
								aria-invalid={Boolean(photoErrorMessage)}
								onChange={(event) =>
									handlePhotoChange(event.target.files?.[0])
								}
							/>
							<FieldDescription>
								{isCompressingPhoto
									? m.citizen_reports_form_photo_compressing()
									: m.citizen_reports_form_photo_hint()}
							</FieldDescription>
							<FieldError>{photoErrorMessage}</FieldError>
							{compressedPhoto && (
								<img
									src={compressedPhoto.previewUrl}
									alt={m.citizen_reports_form_photo_preview_alt()}
									className="max-h-48 w-full rounded-lg border object-cover"
								/>
							)}
						</Field>
						<Field data-invalid={Boolean(locationErrorMessage)}>
							<FieldLabel>{m.citizen_reports_form_location_label()}</FieldLabel>
							<p className="type-data" aria-live="polite">
								{location
									? `${location.lat.toFixed(CITIZEN_REPORT_COORDINATE_DECIMALS)}, ${location.lon.toFixed(CITIZEN_REPORT_COORDINATE_DECIMALS)}`
									: m.citizen_reports_map_pick_hint()}
							</p>
							<Button
								type="button"
								variant="outline"
								className="min-h-11"
								disabled={isLocating}
								onClick={handleUseMyLocation}
							>
								{isLocating && <Spinner data-icon="inline-start" />}
								{isLocating
									? m.citizen_reports_form_locating()
									: m.citizen_reports_form_use_my_location()}
							</Button>
							<FieldError>
								{locationErrorMessage ?? geolocationErrorMessage}
							</FieldError>
						</Field>
						{submitErrorMessage && (
							<Alert variant="destructive" role="alert">
								<AlertDescription>
									{m.citizen_reports_form_submit_error({
										message: submitErrorMessage,
									})}
								</AlertDescription>
							</Alert>
						)}
						<div className="flex flex-wrap gap-3">
							<Button
								type="submit"
								className="min-h-11"
								disabled={isSubmitting || isCompressingPhoto}
							>
								{isSubmitting && <Spinner data-icon="inline-start" />}
								{isSubmitting
									? m.citizen_reports_form_submitting()
									: m.citizen_reports_form_submit()}
							</Button>
							<Button
								type="button"
								variant="ghost"
								className="min-h-11"
								onClick={onCancel}
							>
								{m.citizen_reports_form_cancel()}
							</Button>
						</div>
					</FieldGroup>
				</form>
			</CardContent>
		</Card>
	);
}
