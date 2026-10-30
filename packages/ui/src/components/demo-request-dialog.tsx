import {
	DEMO_COMPANY_MAX_LENGTH_CHARS,
	DEMO_EMAIL_MAX_LENGTH_CHARS,
	DEMO_NAME_MAX_LENGTH_CHARS,
	DEMO_PHONE_MAX_LENGTH_CHARS,
} from "@hack-the-andes-project/business/constants";
import {
	type DemoRequest,
	demoRequestSchema,
} from "@hack-the-andes-project/business/demo-request";
import { Button } from "@hack-the-andes-project/ui/components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@hack-the-andes-project/ui/components/dialog";
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
} from "@hack-the-andes-project/ui/components/field";
import { Input } from "@hack-the-andes-project/ui/components/input";
import { type ComponentProps, useId, useRef, useState } from "react";

interface DemoRequestDialogProps {
	endpoint: string;
	contactPhone: string;
	contactPhoneDisplay: string;
	triggerClassName?: string;
	triggerVariant?: ComponentProps<typeof Button>["variant"];
}

interface DemoRequestValidationError {
	field: keyof DemoRequest;
	message: string;
}

export default function DemoRequestDialog({
	endpoint,
	contactPhone,
	contactPhoneDisplay,
	triggerClassName,
	triggerVariant = "default",
}: DemoRequestDialogProps) {
	const formId = useId();
	const submissionPending = useRef(false);
	const [status, setStatus] = useState<
		"idle" | "submitting" | "sent" | "failed"
	>("idle");
	const [validationError, setValidationError] =
		useState<DemoRequestValidationError | null>(null);

	return (
		<Dialog
			onOpenChange={(_, eventDetails) => {
				if (submissionPending.current) {
					eventDetails.cancel();
					return;
				}
				setStatus("idle");
				setValidationError(null);
			}}
		>
			<DialogTrigger
				render={
					<Button
						variant={triggerVariant}
						size="lg"
						className={triggerClassName}
					/>
				}
			>
				Solicitar una demo
			</DialogTrigger>
			<DialogContent
				className="type-body max-h-[90dvh] overflow-y-auto p-6 sm:max-w-md"
				showCloseButton={false}
			>
				<DialogHeader>
					<DialogTitle>Solicitar una demo</DialogTitle>
					<DialogDescription>
						Déjanos tus datos y te contactaremos para agendar. También puedes
						llamarnos al{" "}
						<a
							className="outline-none focus-visible:ring-1 focus-visible:ring-ring"
							href={`tel:${contactPhone}`}
						>
							{contactPhoneDisplay}
						</a>
						.
					</DialogDescription>
				</DialogHeader>
				{status === "sent" ? (
					<p
						className="type-body rounded-lg border border-border bg-muted p-4 text-foreground"
						role="status"
					>
						Recibimos tu solicitud. Pronto nos pondremos en contacto contigo.
					</p>
				) : (
					<form
						noValidate
						aria-busy={status === "submitting"}
						onSubmit={async (event) => {
							event.preventDefault();
							if (submissionPending.current) return;
							const form = event.currentTarget;
							const result = demoRequestSchema.safeParse(
								Object.fromEntries(new FormData(form)),
							);
							if (!result.success) {
								const issue = result.error.issues[0];
								const field = issue?.path[0];
								if (
									issue &&
									(field === "name" ||
										field === "company" ||
										field === "phone" ||
										field === "email")
								) {
									setValidationError({ field, message: issue.message });
									const input = form.elements.namedItem(field);
									if (input instanceof HTMLElement) input.focus();
								}
								return;
							}
							setValidationError(null);
							submissionPending.current = true;
							setStatus("submitting");
							try {
								const response = await fetch(endpoint, {
									method: "POST",
									headers: { "content-type": "application/json" },
									body: JSON.stringify(result.data),
								});
								setStatus(response.ok ? "sent" : "failed");
							} catch {
								setStatus("failed");
							} finally {
								submissionPending.current = false;
							}
						}}
					>
						<FieldGroup className="gap-4">
							<Field data-invalid={validationError?.field === "name"}>
								<FieldLabel
									className="font-medium font-sans text-sm normal-case tracking-normal"
									htmlFor={`${formId}-name`}
								>
									Nombre
								</FieldLabel>
								<Input
									className="type-body md:type-body h-10 text-foreground focus-visible:ring-ring!"
									id={`${formId}-name`}
									name="name"
									autoComplete="name"
									required
									maxLength={DEMO_NAME_MAX_LENGTH_CHARS}
									aria-invalid={validationError?.field === "name"}
									aria-describedby={
										validationError?.field === "name"
											? `${formId}-error`
											: undefined
									}
									disabled={status === "submitting"}
								/>
							</Field>
							<Field data-invalid={validationError?.field === "company"}>
								<FieldLabel
									className="font-medium font-sans text-sm normal-case tracking-normal"
									htmlFor={`${formId}-company`}
								>
									Empresa (opcional)
								</FieldLabel>
								<Input
									className="type-body md:type-body h-10 text-foreground focus-visible:ring-ring!"
									id={`${formId}-company`}
									name="company"
									autoComplete="organization"
									maxLength={DEMO_COMPANY_MAX_LENGTH_CHARS}
									aria-invalid={validationError?.field === "company"}
									aria-describedby={
										validationError?.field === "company"
											? `${formId}-error`
											: undefined
									}
									disabled={status === "submitting"}
								/>
							</Field>
							<Field data-invalid={validationError?.field === "phone"}>
								<FieldLabel
									className="font-medium font-sans text-sm normal-case tracking-normal"
									htmlFor={`${formId}-phone`}
								>
									Teléfono
								</FieldLabel>
								<Input
									className="type-body md:type-body h-10 text-foreground focus-visible:ring-ring!"
									id={`${formId}-phone`}
									name="phone"
									type="tel"
									autoComplete="tel"
									maxLength={DEMO_PHONE_MAX_LENGTH_CHARS}
									aria-invalid={validationError?.field === "phone"}
									aria-describedby={
										validationError?.field === "phone"
											? `${formId}-error`
											: `${formId}-contact-help`
									}
									disabled={status === "submitting"}
								/>
							</Field>
							<Field data-invalid={validationError?.field === "email"}>
								<FieldLabel
									className="font-medium font-sans text-sm normal-case tracking-normal"
									htmlFor={`${formId}-email`}
								>
									Correo
								</FieldLabel>
								<Input
									className="type-body md:type-body h-10 text-foreground focus-visible:ring-ring!"
									id={`${formId}-email`}
									name="email"
									type="email"
									autoComplete="email"
									maxLength={DEMO_EMAIL_MAX_LENGTH_CHARS}
									aria-invalid={validationError?.field === "email"}
									aria-describedby={
										validationError?.field === "email"
											? `${formId}-error`
											: `${formId}-contact-help`
									}
									disabled={status === "submitting"}
								/>
								<FieldDescription
									className="type-body"
									id={`${formId}-contact-help`}
								>
									Necesitamos tu teléfono o tu correo para contactarte.
								</FieldDescription>
							</Field>
							{validationError && (
								<FieldError
									className="type-body text-destructive"
									id={`${formId}-error`}
								>
									{validationError.message}
								</FieldError>
							)}
							{status === "failed" && (
								<FieldError className="type-body text-destructive">
									No pudimos enviar tu solicitud. Intenta de nuevo o llámanos.
								</FieldError>
							)}
							<Button
								type="submit"
								size="lg"
								disabled={status === "submitting"}
							>
								{status === "submitting" ? "Enviando..." : "Enviar solicitud"}
							</Button>
						</FieldGroup>
					</form>
				)}
				<DialogClose
					render={<Button variant="ghost" disabled={status === "submitting"} />}
				>
					Cerrar
				</DialogClose>
			</DialogContent>
		</Dialog>
	);
}
