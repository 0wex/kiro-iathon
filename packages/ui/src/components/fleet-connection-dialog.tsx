import {
	DEMO_VEHICLES,
	GPS_PROVIDER_LABELS,
	GPS_PROVIDERS,
	gpsCredentialsSchema,
} from "@hack-the-andes-project/business/providers/index";
import { useState } from "react";

import type { FleetConnectionInput } from "../lib/fleet";
import { CREDENTIAL_FIELDS_BY_PROVIDER } from "../lib/fleet-constants";
import { Alert, AlertDescription, AlertTitle } from "./alert";
import { Button } from "./button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "./field";
import { Input } from "./input";
import { ToggleGroup, ToggleGroupItem } from "./toggle-group";

export interface FleetConnectionDialogProps {
	isPending: boolean;
	onCreate: (input: FleetConnectionInput) => Promise<unknown>;
}

export function FleetConnectionDialog({
	isPending,
	onCreate,
}: FleetConnectionDialogProps) {
	const [open, setOpen] = useState(false);
	const [provider, setProvider] =
		useState<FleetConnectionInput["credentials"]["provider"]>("geotab");
	const [error, setError] = useState<string>();
	const [invalidFields, setInvalidFields] = useState<string[]>([]);
	const credentialFields = CREDENTIAL_FIELDS_BY_PROVIDER[provider];

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (isPending) return;
				setOpen(nextOpen);
				setError(undefined);
				setInvalidFields([]);
			}}
		>
			<DialogTrigger render={<Button />}>Conectar proveedor</DialogTrigger>
			<DialogContent
				showCloseButton={false}
				className="max-h-[90svh] overflow-y-auto"
			>
				<DialogHeader>
					<DialogTitle>Conectar proveedor GPS</DialogTitle>
					<DialogDescription>
						Validaremos el acceso e importaremos tus vehículos. Sus posiciones
						se actualizarán cada dos minutos.
					</DialogDescription>
				</DialogHeader>
				<form
					onSubmit={async (event) => {
						event.preventDefault();
						const formData = new FormData(event.currentTarget);
						const credentials = gpsCredentialsSchema.safeParse({
							...Object.fromEntries(formData),
							provider,
						});
						if (!credentials.success) {
							setInvalidFields(
								credentials.error.issues.flatMap((issue) => {
									const [field] = issue.path;
									return typeof field === "string" ? [field] : [];
								}),
							);
							setError("Revisa los campos de acceso del proveedor.");
							return;
						}
						setError(undefined);
						setInvalidFields([]);
						try {
							await onCreate({
								label: String(formData.get("label")),
								credentials: credentials.data,
							});
							setOpen(false);
						} catch (cause) {
							setError(
								cause instanceof Error
									? cause.message
									: "No se pudo conectar el proveedor.",
							);
						}
					}}
					className="flex flex-col gap-4"
				>
					<fieldset disabled={isPending} className="min-w-0">
						<FieldGroup>
							<Field>
								<FieldLabel htmlFor="connection-label">
									Nombre de la conexión
								</FieldLabel>
								<Input
									id="connection-label"
									name="label"
									placeholder="Flota principal"
									required
								/>
							</Field>
							<Field>
								<FieldLabel id="connection-provider-label">
									Proveedor
								</FieldLabel>
								<ToggleGroup
									aria-labelledby="connection-provider-label"
									variant="outline"
									value={[provider]}
									onValueChange={(values) => {
										const nextProvider = GPS_PROVIDERS.find(
											(kind) => kind === values[0],
										);
										if (nextProvider) {
											setProvider(nextProvider);
											setError(undefined);
											setInvalidFields([]);
										}
									}}
								>
									{GPS_PROVIDERS.map((kind) => (
										<ToggleGroupItem
											key={kind}
											value={kind}
											disabled={isPending}
										>
											{GPS_PROVIDER_LABELS[kind]}
										</ToggleGroupItem>
									))}
								</ToggleGroup>
								{provider === "demo" && (
									<FieldDescription>
										Simula {DEMO_VEHICLES.length} camiones en Perú que recorren
										la ruta de cada viaje que les asignes. No necesita
										credenciales.
									</FieldDescription>
								)}
							</Field>
							{credentialFields.map((field) => (
								<Field
									key={field.name}
									data-invalid={invalidFields.includes(field.name)}
								>
									<FieldLabel htmlFor={`connection-${field.name}`}>
										{field.label}
									</FieldLabel>
									<Input
										id={`connection-${field.name}`}
										name={field.name}
										type={field.type}
										defaultValue={field.defaultValue}
										autoComplete={field.autoComplete}
										required
										aria-invalid={invalidFields.includes(field.name)}
									/>
								</Field>
							))}
						</FieldGroup>
					</fieldset>
					{error && (
						<Alert variant="destructive">
							<AlertTitle>No se pudo conectar</AlertTitle>
							<AlertDescription className="break-words">
								{error}
							</AlertDescription>
						</Alert>
					)}
					<DialogFooter>
						<Button
							type="button"
							variant="outline"
							disabled={isPending}
							onClick={() => setOpen(false)}
						>
							Cancelar
						</Button>
						<Button type="submit" disabled={isPending}>
							{isPending ? "Conectando…" : "Conectar proveedor"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
