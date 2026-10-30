import type {
	Incident,
	IncidentTimePreset,
} from "@hack-the-andes-project/ui/lib/incident";
import {
	INCIDENT_CATEGORY_LABELS,
	INCIDENT_CATEGORY_OPTIONS,
	INCIDENT_SEVERITY_LABELS,
	INCIDENT_SEVERITY_OPTIONS,
} from "@hack-the-andes-project/ui/lib/incident-constants";

import { Badge } from "./badge";
import { Button } from "./button";
import { Field, FieldGroup, FieldLabel } from "./field";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";
import { SeverityDot } from "./severity";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

export interface IncidentFiltersProps {
	categories: Incident["category"][];
	severities: Incident["severity"][];
	sincePreset: string;
	sincePresets: IncidentTimePreset[];
	onCategoriesChange: (categories: Incident["category"][]) => void;
	onSeveritiesChange: (severities: Incident["severity"][]) => void;
	onSincePresetChange: (preset: string) => void;
	onReset: () => void;
}

export function IncidentFilters({
	categories,
	severities,
	sincePreset,
	sincePresets,
	onCategoriesChange,
	onSeveritiesChange,
	onSincePresetChange,
	onReset,
}: IncidentFiltersProps) {
	return (
		<section
			aria-label="Filtros de incidentes"
			className="shrink-0 border-b bg-card px-4 py-3"
		>
			<FieldGroup className="flex flex-row flex-wrap items-end gap-3">
				<Field className="w-full gap-1.5 sm:w-auto">
					<FieldLabel htmlFor="incident-category">Categorías</FieldLabel>
					<Select
						multiple
						items={INCIDENT_CATEGORY_OPTIONS}
						value={categories}
						onValueChange={(values) =>
							onCategoriesChange(
								values.filter((value): value is Incident["category"] =>
									Object.hasOwn(INCIDENT_CATEGORY_LABELS, value),
								),
							)
						}
					>
						<SelectTrigger id="incident-category" className="w-full sm:w-48">
							<SelectValue>
								{categories.length ? (
									<span className="flex items-center gap-2">
										Categorías{" "}
										<Badge variant="secondary">{categories.length}</Badge>
									</span>
								) : (
									"Todas las categorías"
								)}
							</SelectValue>
						</SelectTrigger>
						<SelectContent alignItemWithTrigger={false} className="w-64">
							<SelectGroup>
								{INCIDENT_CATEGORY_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
				<Field className="w-auto gap-1.5">
					<FieldLabel id="incident-severity-label">Severidad</FieldLabel>
					<ToggleGroup
						multiple
						variant="outline"
						value={severities}
						aria-labelledby="incident-severity-label"
						onValueChange={(values) =>
							onSeveritiesChange(
								INCIDENT_SEVERITY_OPTIONS.filter((severity) =>
									values.includes(severity),
								),
							)
						}
					>
						{INCIDENT_SEVERITY_OPTIONS.map((severity) => (
							<ToggleGroupItem key={severity} value={severity}>
								<SeverityDot severity={severity} />
								{INCIDENT_SEVERITY_LABELS[severity]}
							</ToggleGroupItem>
						))}
					</ToggleGroup>
				</Field>
				<Field className="w-auto gap-1.5">
					<FieldLabel htmlFor="incident-since">Último cambio</FieldLabel>
					<Select
						items={sincePresets}
						value={sincePreset}
						onValueChange={(value) => {
							if (value !== null) onSincePresetChange(value);
						}}
					>
						<SelectTrigger id="incident-since">
							<SelectValue />
						</SelectTrigger>
						<SelectContent alignItemWithTrigger={false}>
							<SelectGroup>
								{sincePresets.map((preset) => (
									<SelectItem key={preset.value} value={preset.value}>
										{preset.label}
									</SelectItem>
								))}
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
				<Button variant="ghost" onClick={onReset}>
					Restablecer
				</Button>
			</FieldGroup>
			{Boolean(categories.length) && (
				<p className="type-body mt-2 text-muted-foreground">
					{categories
						.map((category) => INCIDENT_CATEGORY_LABELS[category])
						.join(" · ")}
				</p>
			)}
		</section>
	);
}
