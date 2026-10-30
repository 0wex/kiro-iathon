import {
	Accordion,
	AccordionContent,
	AccordionItem,
	AccordionTrigger,
} from "@hack-the-andes-project/ui/components/accordion";
import { AspectRatio } from "@hack-the-andes-project/ui/components/aspect-ratio";
import {
	Avatar,
	AvatarFallback,
	AvatarGroup,
} from "@hack-the-andes-project/ui/components/avatar";
import { Badge } from "@hack-the-andes-project/ui/components/badge";
import { Button } from "@hack-the-andes-project/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@hack-the-andes-project/ui/components/card";
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
} from "@hack-the-andes-project/ui/components/carousel";
import {
	CodeBlock,
	CodeBlockContent,
	CodeBlockHeader,
	CodeBlockTitle,
} from "@hack-the-andes-project/ui/components/code-block";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@hack-the-andes-project/ui/components/collapsible";
import { TopoBackground } from "@hack-the-andes-project/ui/components/contour-art";
import {
	Item,
	ItemActions,
	ItemContent,
	ItemDescription,
	ItemGroup,
	ItemTitle,
} from "@hack-the-andes-project/ui/components/item";
import {
	ResizableHandle,
	ResizablePanel,
	ResizablePanelGroup,
} from "@hack-the-andes-project/ui/components/resizable";
import { ScrollArea } from "@hack-the-andes-project/ui/components/scroll-area";
import { Separator } from "@hack-the-andes-project/ui/components/separator";
import { ShowcaseTier } from "@hack-the-andes-project/ui/components/showcase/tier";
import { toast } from "sonner";
import {
	ROUTE_EXAMPLES,
	SHOWCASE_JSON_INDENT,
	SHOWCASE_PREVIEW_ASPECT_RATIO,
} from "@/constants";
import { m } from "@/paraglide/messages";

export function DataDisplayShowcase() {
	return (
		<ShowcaseTier
			id="components-data-display"
			title={m.ds_tier_data_display()}
			description={m.ds_tier_data_display_description()}
		>
			<Card>
				<CardHeader>
					<CardTitle>{m.ds_carretera_central()}</CardTitle>
					<CardDescription>{m.ds_route_card_description()}</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<Badge variant="critical">{m.risk_critical()}</Badge>
					<p>{m.ds_route_card_alert()}</p>
				</CardContent>
				<CardFooter className="flex-wrap gap-2">
					<Button onClick={() => toast.info(m.ds_toast_reroute_opened())}>
						{m.ds_evaluate_reroute()}
					</Button>
					<Button
						variant="outline"
						onClick={() => toast.info(m.ds_toast_source_opened())}
					>
						{m.ds_view_source()}
					</Button>
				</CardFooter>
			</Card>
			<div className="grid min-w-0 gap-6 lg:grid-cols-2">
				<div className="flex min-w-0 flex-col gap-6">
					<div className="flex items-center gap-4">
						<AvatarGroup>
							<Avatar>
								<AvatarFallback>EF</AvatarFallback>
							</Avatar>
							<Avatar>
								<AvatarFallback>OP</AvatarFallback>
							</Avatar>
						</AvatarGroup>
						<span className="type-label">{m.ds_team_on_duty()}</span>
					</div>
					<Accordion defaultValue={["sources"]}>
						<AccordionItem value="sources">
							<AccordionTrigger>{m.ds_sources()}</AccordionTrigger>
							<AccordionContent>{m.ds_source_summary()}</AccordionContent>
						</AccordionItem>
						<AccordionItem value="recommendation">
							<AccordionTrigger>{m.ds_view_recommendation()}</AccordionTrigger>
							<AccordionContent>{m.ds_assistant_message()}</AccordionContent>
						</AccordionItem>
					</Accordion>
					<Collapsible>
						<CollapsibleTrigger render={<Button variant="outline" />}>
							{m.ds_show_source_details()}
						</CollapsibleTrigger>
						<CollapsibleContent className="pt-4 text-sm">
							{m.ds_source_summary()}
						</CollapsibleContent>
					</Collapsible>
				</div>
				<ScrollArea className="h-72 rounded-lg border">
					<ItemGroup className="p-3">
						{ROUTE_EXAMPLES.map((route) => (
							<Item key={route.id} variant="outline">
								<ItemContent>
									<ItemTitle>{route.name()}</ItemTitle>
									<ItemDescription>{route.cause()}</ItemDescription>
								</ItemContent>
								<ItemActions>
									<Badge variant={route.risk}>{route.riskLabel()}</Badge>
								</ItemActions>
							</Item>
						))}
					</ItemGroup>
				</ScrollArea>
			</div>
			<div className="min-w-0 px-12">
				<Carousel aria-label={m.ds_panel_title()}>
					<CarouselContent>
						{ROUTE_EXAMPLES.map((route) => (
							<CarouselItem key={route.id} className="md:basis-1/2">
								<Card className="h-full">
									<CardHeader>
										<CardTitle>{route.name()}</CardTitle>
										<CardDescription>{route.cause()}</CardDescription>
									</CardHeader>
									<CardContent>
										<Badge variant={route.risk}>{route.riskLabel()}</Badge>
									</CardContent>
								</Card>
							</CarouselItem>
						))}
					</CarouselContent>
					<CarouselPrevious aria-label={m.ds_previous()} />
					<CarouselNext aria-label={m.ds_next()} />
				</Carousel>
			</div>
			<ResizablePanelGroup
				orientation="horizontal"
				className="min-h-40 overflow-hidden rounded-lg border"
			>
				<ResizablePanel defaultSize="60%" minSize="30%">
					<div className="flex h-full flex-col gap-3 p-4">
						<h4 className="type-label">{m.ds_route_context()}</h4>
						<p className="text-sm">{m.ds_carretera_central()}</p>
					</div>
				</ResizablePanel>
				<ResizableHandle withHandle aria-label={m.ds_resize_panels()} />
				<ResizablePanel defaultSize="40%" minSize="25%">
					<div className="flex h-full flex-col gap-3 p-4">
						<Badge variant="critical">{m.risk_critical()}</Badge>
						<p className="text-sm">{m.recommendation_reroute()}</p>
					</div>
				</ResizablePanel>
			</ResizablePanelGroup>
			<div className="grid min-w-0 gap-6 md:grid-cols-2">
				<AspectRatio
					ratio={SHOWCASE_PREVIEW_ASPECT_RATIO}
					className="overflow-hidden rounded-lg border bg-muted"
				>
					<TopoBackground className="text-foreground/10" />
					<div className="relative flex h-full flex-col justify-center gap-4 p-6">
						<span className="type-label">{m.ds_route_preview()}</span>
						<h4 className="type-heading">{m.ds_carretera_central()}</h4>
						<Badge variant="critical">{m.risk_critical()}</Badge>
					</div>
				</AspectRatio>
				<CodeBlock>
					<CodeBlockHeader>
						<CodeBlockTitle>{m.ds_route_payload()}</CodeBlockTitle>
					</CodeBlockHeader>
					<CodeBlockContent lineNumbers wrap>
						{JSON.stringify(
							{ route: "PE-22", risk: "critical", recommendation: "reroute" },
							null,
							SHOWCASE_JSON_INDENT,
						)}
					</CodeBlockContent>
				</CodeBlock>
			</div>
			<Separator />
		</ShowcaseTier>
	);
}
