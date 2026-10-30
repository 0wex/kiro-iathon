import { Calendar } from "@hack-the-andes-project/ui/components/calendar";
import { Checkbox } from "@hack-the-andes-project/ui/components/checkbox";
import {
	Combobox,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
} from "@hack-the-andes-project/ui/components/combobox";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from "@hack-the-andes-project/ui/components/field";
import { Input } from "@hack-the-andes-project/ui/components/input";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from "@hack-the-andes-project/ui/components/input-group";
import {
	InputOTP,
	InputOTPGroup,
	InputOTPSlot,
} from "@hack-the-andes-project/ui/components/input-otp";
import { Label } from "@hack-the-andes-project/ui/components/label";
import {
	NativeSelect,
	NativeSelectOption,
} from "@hack-the-andes-project/ui/components/native-select";
import {
	RadioGroup,
	RadioGroupItem,
} from "@hack-the-andes-project/ui/components/radio-group";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@hack-the-andes-project/ui/components/select";
import {
	enUS,
	es,
} from "@hack-the-andes-project/ui/components/showcase/calendar-locales";
import { SearchIcon } from "@hack-the-andes-project/ui/components/showcase/icons";
import {
	previewState,
	StateMatrix,
} from "@hack-the-andes-project/ui/components/showcase/state-matrix";
import { ShowcaseTier } from "@hack-the-andes-project/ui/components/showcase/tier";
import { Slider } from "@hack-the-andes-project/ui/components/slider";
import { Switch } from "@hack-the-andes-project/ui/components/switch";
import { Textarea } from "@hack-the-andes-project/ui/components/textarea";
import { useState } from "react";
import { ThemeSwitchControl } from "@/components/theme-switch-control";
import {
	getShowcaseStateLabels,
	ROUTE_EXAMPLES,
	SHOWCASE_DATE_ISO,
	SHOWCASE_HORIZON_HOURS,
	SHOWCASE_MAX_HORIZON_HOURS,
	SHOWCASE_OTP_INDICES,
	SHOWCASE_OTP_LENGTH,
} from "@/constants";
import { m } from "@/paraglide/messages";
import { getLocale } from "@/paraglide/runtime";

export function InputsShowcase() {
	const [departureDate, setDepartureDate] = useState<Date | undefined>(
		new Date(SHOWCASE_DATE_ISO),
	);
	const routeOptions = ROUTE_EXAMPLES.map((route) => ({
		value: route.id,
		label: route.name(),
	}));
	const routeNames = routeOptions.map((route) => route.label);
	const stateLabels = getShowcaseStateLabels();
	return (
		<ShowcaseTier
			id="components-inputs"
			title={m.ds_tier_inputs()}
			description={m.ds_tier_inputs_description()}
		>
			<div className="flex min-w-0 flex-col gap-6">
				<section className="flex flex-col gap-3 rounded-lg border p-5">
					<h3 className="type-heading">{m.ds_theme_switch_title()}</h3>
					<p className="type-body text-muted-foreground">
						{m.ds_theme_switch_description()}
					</p>
					<ThemeSwitchControl showLabel className="w-fit" />
				</section>
				<div>
					<h3 className="type-heading">{m.ds_fields_title()}</h3>
					<p className="mt-2 text-muted-foreground text-sm">
						{m.ds_fields_description()}
					</p>
				</div>
				<FieldGroup className="grid gap-6 md:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="route-search">
							{m.ds_search_route()}
						</FieldLabel>
						<InputGroup>
							<InputGroupAddon>
								<SearchIcon />
							</InputGroupAddon>
							<InputGroupInput
								id="route-search"
								placeholder={m.ds_carretera_central()}
							/>
							<InputGroupAddon align="inline-end">
								<InputGroupText>{m.ds_country_code()}</InputGroupText>
							</InputGroupAddon>
						</InputGroup>
						<FieldDescription>{m.ds_search_route_hint()}</FieldDescription>
					</Field>
					<Field data-invalid>
						<FieldLabel htmlFor="invalid-location">
							{m.ds_incident_kilometer()}
						</FieldLabel>
						<Input
							id="invalid-location"
							defaultValue={m.ds_la_oroya()}
							aria-invalid="true"
							aria-describedby="location-error"
							required
						/>
						<FieldError id="location-error">
							{m.ds_incident_kilometer_error()}
						</FieldError>
					</Field>
					<Field>
						<FieldLabel htmlFor="route-notes">
							{m.ds_operator_notes()}
						</FieldLabel>
						<Textarea
							id="route-notes"
							defaultValue={m.ds_operator_notes_sample()}
						/>
					</Field>
					<Field data-disabled>
						<FieldLabel htmlFor="disabled-source">
							{m.ds_reference_source()}
						</FieldLabel>
						<Input
							id="disabled-source"
							defaultValue={m.ds_confirmed_source()}
							disabled
						/>
						<FieldDescription>{m.ds_reference_source_hint()}</FieldDescription>
					</Field>
				</FieldGroup>
				<StateMatrix
					variantLabel={m.ds_variant()}
					stateLabels={stateLabels}
					rows={["Input", "Textarea", "Checkbox"]}
					states={["default", "hover", "focus", "disabled", "invalid"]}
					render={(control, state) => {
						const fieldId = `preview-${control}-${state}`;
						return (
							<Field
								orientation={control === "Checkbox" ? "horizontal" : "vertical"}
								data-invalid={state === "invalid" || undefined}
								data-disabled={state === "disabled" || undefined}
								className="min-w-40"
							>
								<FieldLabel
									htmlFor={fieldId}
									className="flex-none! whitespace-nowrap"
								>
									{control === "Checkbox"
										? m.ds_receive_alerts()
										: m.ds_route_label()}
								</FieldLabel>
								{control === "Input" ? (
									<Input
										id={fieldId}
										defaultValue={m.ds_sample_route_code()}
										aria-invalid={state === "invalid" || undefined}
										{...previewState(state)}
									/>
								) : control === "Textarea" ? (
									<Textarea
										id={fieldId}
										defaultValue={m.ds_check_segment()}
										aria-invalid={state === "invalid" || undefined}
										{...previewState(state)}
									/>
								) : (
									<Checkbox
										id={fieldId}
										defaultChecked
										aria-invalid={state === "invalid" || undefined}
										{...previewState(state)}
									/>
								)}
							</Field>
						);
					}}
				/>
			</div>
			<FieldSet>
				<FieldLegend>{m.ds_preferences()}</FieldLegend>
				<FieldDescription>{m.ds_search_route_hint()}</FieldDescription>
				<FieldGroup className="grid min-w-0 gap-6 md:grid-cols-2">
					<Field>
						<FieldLabel htmlFor="select-route">{m.ds_route_label()}</FieldLabel>
						<Select items={routeOptions} defaultValue="PE-22">
							<SelectTrigger id="select-route" className="w-full min-w-0">
								<SelectValue className="min-w-0 truncate" />
							</SelectTrigger>
							<SelectContent>
								<SelectGroup>
									{routeOptions.map((route) => (
										<SelectItem key={route.value} value={route.value}>
											{route.label}
										</SelectItem>
									))}
								</SelectGroup>
							</SelectContent>
						</Select>
					</Field>
					<Field>
						<FieldLabel htmlFor="native-cargo">
							{m.ds_transport_mode()}
						</FieldLabel>
						<NativeSelect id="native-cargo">
							<NativeSelectOption value="general">
								{m.ds_cargo_general()}
							</NativeSelectOption>
							<NativeSelectOption value="perishable">
								{m.ds_cargo_perishable()}
							</NativeSelectOption>
						</NativeSelect>
					</Field>
					<Field>
						<FieldLabel htmlFor="combobox-route">
							{m.ds_search_route()}
						</FieldLabel>
						<Combobox items={routeNames}>
							<ComboboxInput
								id="combobox-route"
								placeholder={m.ds_select_route()}
							/>
							<ComboboxContent>
								<ComboboxEmpty>{m.ds_no_route_matches()}</ComboboxEmpty>
								<ComboboxList>
									{(route: string) => (
										<ComboboxItem key={route} value={route}>
											{route}
										</ComboboxItem>
									)}
								</ComboboxList>
							</ComboboxContent>
						</Combobox>
					</Field>
					<FieldSet>
						<FieldLegend variant="label">{m.ds_transport_mode()}</FieldLegend>
						<RadioGroup defaultValue="general">
							<Field orientation="horizontal">
								<RadioGroupItem id="cargo-general" value="general" />
								<FieldLabel htmlFor="cargo-general">
									{m.ds_cargo_general()}
								</FieldLabel>
							</Field>
							<Field orientation="horizontal">
								<RadioGroupItem id="cargo-perishable" value="perishable" />
								<FieldLabel htmlFor="cargo-perishable">
									{m.ds_cargo_perishable()}
								</FieldLabel>
							</Field>
						</RadioGroup>
					</FieldSet>
					<Field orientation="horizontal">
						<Switch id="monitor-switch" defaultChecked />
						<FieldLabel htmlFor="monitor-switch">
							{m.ds_receive_alerts()}
						</FieldLabel>
					</Field>
					<Field>
						<FieldLabel id="dispatch-horizon-label">
							{m.ds_dispatch_window()}
						</FieldLabel>
						<Slider
							aria-labelledby="dispatch-horizon-label"
							defaultValue={[SHOWCASE_HORIZON_HOURS]}
							max={SHOWCASE_MAX_HORIZON_HOURS}
							step={SHOWCASE_HORIZON_HOURS}
						/>
						<FieldDescription>{m.ds_forecast_window()}</FieldDescription>
					</Field>
					<Field>
						<FieldLabel htmlFor="verification-code">
							{m.ds_verification_code()}
						</FieldLabel>
						<InputOTP
							id="verification-code"
							maxLength={SHOWCASE_OTP_LENGTH}
							inputMode="numeric"
						>
							<InputOTPGroup>
								{SHOWCASE_OTP_INDICES.map((index) => (
									<InputOTPSlot key={index} index={index} />
								))}
							</InputOTPGroup>
						</InputOTP>
					</Field>
					<Field>
						<Label htmlFor="route-alias">{m.ds_route_alias()}</Label>
						<Input id="route-alias" placeholder={m.ds_carretera_central()} />
					</Field>
					<Field className="min-w-0">
						<FieldLabel id="departure-date-label">
							{m.ds_departure_date()}
						</FieldLabel>
						<div>
							<Calendar
								mode="single"
								aria-labelledby="departure-date-label"
								selected={departureDate}
								onSelect={setDepartureDate}
								defaultMonth={new Date(SHOWCASE_DATE_ISO)}
								locale={getLocale() === "es" ? es : enUS}
								className="w-fit max-w-full rounded-lg border"
							/>
						</div>
					</Field>
				</FieldGroup>
			</FieldSet>
			<StateMatrix
				variantLabel={m.ds_variant()}
				stateLabels={stateLabels}
				rows={["Switch", "RadioGroup", "Slider"]}
				states={["default", "hover", "focus", "disabled", "invalid"]}
				render={(control, state) => (
					<Field
						data-invalid={state === "invalid" || undefined}
						data-disabled={state === "disabled" || undefined}
						className="min-w-40 gap-2"
						orientation="horizontal"
					>
						<FieldLabel
							id={`extra-${control}-${state}`}
							className="flex-none! whitespace-nowrap"
						>
							{control === "Slider"
								? m.ds_horizon_label()
								: m.ds_receive_alerts()}
						</FieldLabel>
						{control === "Switch" ? (
							<Switch
								aria-labelledby={`extra-${control}-${state}`}
								aria-invalid={state === "invalid"}
								{...previewState(state)}
								defaultChecked
							/>
						) : control === "RadioGroup" ? (
							<RadioGroup
								aria-labelledby={`extra-${control}-${state}`}
								defaultValue="monitor"
								{...previewState(state)}
							>
								<RadioGroupItem
									value="monitor"
									aria-label={m.recommendation_monitor()}
									aria-invalid={state === "invalid"}
								/>
							</RadioGroup>
						) : (
							<Slider
								className="w-24! shrink-0"
								aria-labelledby={`extra-${control}-${state}`}
								aria-invalid={state === "invalid"}
								defaultValue={[SHOWCASE_HORIZON_HOURS]}
								max={SHOWCASE_MAX_HORIZON_HOURS}
								{...previewState(state)}
							/>
						)}
					</Field>
				)}
			/>

			<StateMatrix
				variantLabel={m.ds_variant()}
				stateLabels={stateLabels}
				rows={["Select", "NativeSelect"]}
				states={["default", "hover", "focus", "disabled", "invalid"]}
				render={(control, state) => {
					const fieldId = `selection-${control}-${state}`;
					return (
						<Field
							data-invalid={state === "invalid" || undefined}
							data-disabled={state === "disabled" || undefined}
							className="min-w-44"
						>
							<FieldLabel htmlFor={fieldId}>{m.ds_route_label()}</FieldLabel>
							{control === "Select" ? (
								<Select
									items={routeOptions}
									defaultValue="PE-22"
									disabled={state === "disabled"}
								>
									<SelectTrigger
										id={fieldId}
										aria-invalid={state === "invalid"}
										{...previewState(state)}
									>
										<SelectValue className="min-w-0 truncate" />
									</SelectTrigger>
									<SelectContent>
										<SelectGroup>
											{routeOptions.map((route) => (
												<SelectItem key={route.value} value={route.value}>
													{route.label}
												</SelectItem>
											))}
										</SelectGroup>
									</SelectContent>
								</Select>
							) : (
								<NativeSelect
									id={fieldId}
									aria-invalid={state === "invalid"}
									{...previewState(state)}
								>
									{routeOptions.map((route) => (
										<NativeSelectOption key={route.value} value={route.value}>
											{route.label}
										</NativeSelectOption>
									))}
								</NativeSelect>
							)}
						</Field>
					);
				}}
			/>
			<FieldGroup className="grid min-w-0 gap-6 md:grid-cols-2">
				<Field data-disabled>
					<FieldLabel htmlFor="disabled-combobox">
						{m.ds_search_route()}
					</FieldLabel>
					<Combobox items={routeNames} disabled>
						<ComboboxInput
							id="disabled-combobox"
							disabled
							placeholder={m.ds_select_route()}
						/>
					</Combobox>
					<FieldDescription>{m.ds_reference_source_hint()}</FieldDescription>
				</Field>
				<Field data-invalid>
					<FieldLabel htmlFor="invalid-otp">
						{m.ds_verification_code()}
					</FieldLabel>
					<InputOTP
						id="invalid-otp"
						aria-invalid
						aria-describedby="otp-error"
						maxLength={SHOWCASE_OTP_LENGTH}
						inputMode="numeric"
						required
					>
						<InputOTPGroup>
							{SHOWCASE_OTP_INDICES.map((index) => (
								<InputOTPSlot key={index} index={index} />
							))}
						</InputOTPGroup>
					</InputOTP>
					<FieldError id="otp-error">{m.ds_code_required()}</FieldError>
				</Field>
			</FieldGroup>
		</ShowcaseTier>
	);
}
