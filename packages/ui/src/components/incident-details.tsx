import type { Incident } from "@hack-the-andes-project/ui/lib/incident";
import {
	INCIDENT_CATEGORY_LABELS,
	INCIDENT_SOURCE_LABELS,
	ROAD_STATUS_LABELS,
} from "@hack-the-andes-project/ui/lib/incident-constants";
import { formatDistanceToNowStrict } from "date-fns";
import { es } from "date-fns/locale/es";
import { Fragment } from "react";

import { Badge } from "./badge";
import { DateTime } from "./date-time";
import { SeverityBadge } from "./severity";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "./sheet";

export interface IncidentDetailsProps {
	incident?: Incident;
	onClose: () => void;
}

export function IncidentDetails({ incident, onClose }: IncidentDetailsProps) {
	const details = incident
		? [
				{
					label: "Ocurrió",
					value: incident.occurredAt && (
						<DateTime value={incident.occurredAt} />
					),
				},
				{
					label: "Vigente hasta",
					value: incident.validUntil && (
						<DateTime value={incident.validUntil} />
					),
				},
				{
					label: "Vía",
					value: [incident.roadCode, incident.roadName]
						.filter(Boolean)
						.join(" · "),
				},
				{ label: "Kilómetro", value: incident.roadKm },
				{
					label: "Ubicación",
					value: [
						...new Set(
							[incident.distrito, incident.provincia, incident.region].filter(
								Boolean,
							),
						),
					].join(", "),
				},
				{
					label: "Fuente",
					value: INCIDENT_SOURCE_LABELS[incident.source] ?? incident.source,
				},
				{
					label: "Actualizado",
					value: <DateTime value={incident.lastChangedAt} />,
				},
			].filter((detail) => detail.value)
		: [];

	return (
		<Sheet
			open={Boolean(incident)}
			onOpenChange={(open) => {
				if (!open) onClose();
			}}
		>
			<SheetContent className="overflow-y-auto">
				<SheetHeader className="gap-2 pr-12">
					{incident && (
						<div className="flex flex-wrap gap-1.5">
							<SeverityBadge severity={incident.severity} />
							{incident.roadStatus && (
								<Badge
									variant={
										incident.roadStatus === "interrumpido"
											? "destructive"
											: "outline"
									}
								>
									{ROAD_STATUS_LABELS[incident.roadStatus]}
								</Badge>
							)}
						</div>
					)}
					<SheetTitle className="text-balance break-words">
						{incident?.title ?? "Detalle del incidente"}
					</SheetTitle>
					<SheetDescription>
						{incident ? (
							<>
								{INCIDENT_CATEGORY_LABELS[incident.category]}
								{incident.occurredAt && (
									<>
										{" · "}
										<time dateTime={incident.occurredAt.toISOString()}>
											{formatDistanceToNowStrict(incident.occurredAt, {
												addSuffix: true,
												locale: es,
											})}
										</time>
									</>
								)}
							</>
						) : (
							"Información del incidente"
						)}
					</SheetDescription>
				</SheetHeader>
				{incident && (
					<div className="flex flex-col gap-4 px-4 pb-6">
						{incident.imageUrl && (
							<a
								href={incident.imageUrl}
								target="_blank"
								rel="noopener noreferrer"
								className="outline-offset-4 focus-visible:outline-2 focus-visible:outline-ring"
							>
								<img
									src={incident.imageUrl}
									alt={`Foto reportada: ${incident.title}`}
									loading="lazy"
									className="aspect-video w-full rounded-lg bg-muted object-cover"
								/>
								<span className="sr-only">(abre la foto en otra pestaña)</span>
							</a>
						)}
						{incident.description && (
							<p className="type-body whitespace-pre-line">
								{incident.description}
							</p>
						)}
						<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2.5 border-t pt-4">
							{details.map((detail) => (
								<Fragment key={detail.label}>
									<dt className="type-label text-muted-foreground">
										{detail.label}
									</dt>
									<dd className="type-data break-words">{detail.value}</dd>
								</Fragment>
							))}
						</dl>
					</div>
				)}
			</SheetContent>
		</Sheet>
	);
}
