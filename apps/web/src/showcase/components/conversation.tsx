import {
	Attachment,
	AttachmentContent,
	AttachmentDescription,
	AttachmentMedia,
	AttachmentTitle,
} from "@hack-the-andes-project/ui/components/attachment";
import {
	Bubble,
	BubbleContent,
} from "@hack-the-andes-project/ui/components/bubble";
import {
	Marker,
	MarkerContent,
} from "@hack-the-andes-project/ui/components/marker";
import {
	Message,
	MessageContent,
	MessageFooter,
	MessageHeader,
} from "@hack-the-andes-project/ui/components/message";
import {
	MessageScroller,
	MessageScrollerButton,
	MessageScrollerContent,
	MessageScrollerItem,
	MessageScrollerProvider,
	MessageScrollerViewport,
} from "@hack-the-andes-project/ui/components/message-scroller";
import {
	Questionnaire,
	QuestionnaireActions,
	QuestionnaireChoice,
	QuestionnaireChoices,
	QuestionnaireDescription,
	QuestionnaireItem,
	QuestionnaireNext,
	QuestionnairePrevious,
	QuestionnaireSkip,
	QuestionnaireSubmit,
	QuestionnaireTitle,
} from "@hack-the-andes-project/ui/components/questionnaire";
import {
	ArrowDownIcon,
	FileTextIcon,
} from "@hack-the-andes-project/ui/components/showcase/icons";
import { ShowcaseTier } from "@hack-the-andes-project/ui/components/showcase/tier";
import {
	Trace,
	TraceDescription,
	TraceIcon,
	TraceLine,
	TraceTitle,
} from "@hack-the-andes-project/ui/components/trace";
import { toast } from "sonner";
import { SHOWCASE_QUESTIONNAIRE_ITEMS } from "@/constants";
import { m } from "@/paraglide/messages";

export function ConversationShowcase() {
	return (
		<ShowcaseTier
			id="components-conversation"
			title={m.ds_tier_conversation()}
			description={m.ds_tier_conversation_description()}
		>
			<div className="flex min-w-0 flex-col gap-6">
				<h3 className="type-heading">{m.ds_conversation_title()}</h3>
				<p className="type-body text-muted-foreground">
					{m.ds_conversation_description()}
				</p>
				<div className="h-96 min-w-0 rounded-lg border bg-card p-4">
					<MessageScrollerProvider>
						<MessageScroller>
							<MessageScrollerViewport>
								<MessageScrollerContent>
									<MessageScrollerItem messageId="context">
										<Marker variant="separator">
											<MarkerContent>{m.ds_conversation_date()}</MarkerContent>
										</Marker>
									</MessageScrollerItem>
									<MessageScrollerItem messageId="operator" scrollAnchor>
										<Message align="end">
											<MessageContent>
												<MessageHeader>{m.ds_operations()}</MessageHeader>
												<Bubble align="end">
													<BubbleContent>
														{m.ds_operator_message()}
													</BubbleContent>
												</Bubble>
												<MessageFooter>08:12</MessageFooter>
											</MessageContent>
										</Message>
									</MessageScrollerItem>
									<MessageScrollerItem messageId="assistant">
										<Message>
											<MessageContent>
												<MessageHeader>{m.ds_assistant_name()}</MessageHeader>
												<Bubble variant="secondary">
													<BubbleContent>
														{m.ds_assistant_message()}
													</BubbleContent>
												</Bubble>
												<Attachment state="done">
													<AttachmentMedia variant="icon">
														<FileTextIcon />
													</AttachmentMedia>
													<AttachmentContent>
														<AttachmentTitle>
															{m.ds_closure_attachment_name()}
														</AttachmentTitle>
														<AttachmentDescription>
															{m.ds_attachment_reference()}
														</AttachmentDescription>
													</AttachmentContent>
												</Attachment>
												<MessageFooter>
													{m.ds_assistant_timestamp()}
												</MessageFooter>
											</MessageContent>
										</Message>
									</MessageScrollerItem>
									<MessageScrollerItem messageId="attachment-error">
										<Message>
											<MessageContent>
												<Attachment state="error">
													<AttachmentMedia variant="icon">
														<FileTextIcon />
													</AttachmentMedia>
													<AttachmentContent>
														<AttachmentTitle>
															{m.ds_field_attachment_name()}
														</AttachmentTitle>
														<AttachmentDescription>
															{m.ds_attachment_error()}
														</AttachmentDescription>
													</AttachmentContent>
												</Attachment>
											</MessageContent>
										</Message>
									</MessageScrollerItem>
								</MessageScrollerContent>
							</MessageScrollerViewport>
							<MessageScrollerButton aria-label={m.ds_scroll_latest()}>
								<ArrowDownIcon />
							</MessageScrollerButton>
						</MessageScroller>
					</MessageScrollerProvider>
				</div>
			</div>
			<div className="grid min-w-0 gap-6 lg:grid-cols-2">
				<div className="min-w-0 rounded-lg border p-6">
					<h4 className="type-heading mb-5">{m.ds_questionnaire_title()}</h4>
					<Questionnaire
						items={SHOWCASE_QUESTIONNAIRE_ITEMS}
						onSubmit={(event) => {
							event.preventDefault();
							toast.success(m.ds_answers_saved());
						}}
					>
						<QuestionnaireItem name="route">
							<QuestionnaireTitle>{m.ds_question_route()}</QuestionnaireTitle>
							<QuestionnaireDescription>
								{m.ds_questionnaire_description()}
							</QuestionnaireDescription>
							<QuestionnaireChoices>
								<QuestionnaireChoice value="PE-22">
									{m.ds_carretera_central()}
								</QuestionnaireChoice>
								<QuestionnaireChoice value="PE-1N">
									{m.ds_route_north_name()}
								</QuestionnaireChoice>
							</QuestionnaireChoices>
						</QuestionnaireItem>
						<QuestionnaireItem name="cargo">
							<QuestionnaireTitle>{m.ds_question_cargo()}</QuestionnaireTitle>
							<QuestionnaireChoices>
								<QuestionnaireChoice value="general">
									{m.ds_cargo_general()}
								</QuestionnaireChoice>
								<QuestionnaireChoice value="perishable">
									{m.ds_cargo_perishable()}
								</QuestionnaireChoice>
							</QuestionnaireChoices>
						</QuestionnaireItem>
						<QuestionnaireActions>
							<QuestionnairePrevious>{m.ds_previous()}</QuestionnairePrevious>
							<QuestionnaireSkip>{m.ds_skip()}</QuestionnaireSkip>
							<QuestionnaireNext>{m.ds_next()}</QuestionnaireNext>
							<QuestionnaireSubmit>{m.ds_submit_answers()}</QuestionnaireSubmit>
						</QuestionnaireActions>
					</Questionnaire>
				</div>
				<div className="min-w-0 rounded-lg border p-6">
					<h4 className="type-heading mb-5">{m.ds_trace_title()}</h4>
					<Trace>
						<TraceLine>
							<TraceIcon>
								<FileTextIcon />
							</TraceIcon>
							<TraceTitle>{m.ds_trace_verified()}</TraceTitle>
							<TraceDescription className="shrink whitespace-normal">
								{m.ds_confirmed_source()}
							</TraceDescription>
						</TraceLine>
						<TraceLine>
							<TraceIcon>
								<FileTextIcon />
							</TraceIcon>
							<TraceTitle>{m.ds_trace_forecast()}</TraceTitle>
							<TraceDescription className="shrink whitespace-normal">
								{m.ds_senamhi_orange_warning()}
							</TraceDescription>
						</TraceLine>
						<TraceLine status="pending">
							<TraceIcon>
								<FileTextIcon />
							</TraceIcon>
							<TraceTitle>{m.ds_trace_pending()}</TraceTitle>
						</TraceLine>
					</Trace>
				</div>
			</div>
		</ShowcaseTier>
	);
}
