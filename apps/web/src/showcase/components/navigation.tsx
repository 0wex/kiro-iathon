import { Badge } from "@hack-the-andes-project/ui/components/badge";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@hack-the-andes-project/ui/components/breadcrumb";
import { DirectionProvider } from "@hack-the-andes-project/ui/components/direction";
import {
	CloudLightningIcon,
	MapPinIcon,
} from "@hack-the-andes-project/ui/components/icons";
import {
	Menubar,
	MenubarContent,
	MenubarGroup,
	MenubarItem,
	MenubarMenu,
	MenubarTrigger,
} from "@hack-the-andes-project/ui/components/menubar";
import {
	NavigationMenu,
	NavigationMenuContent,
	NavigationMenuItem,
	NavigationMenuLink,
	NavigationMenuList,
	NavigationMenuTrigger,
} from "@hack-the-andes-project/ui/components/navigation-menu";
import {
	Pagination,
	PaginationContent,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@hack-the-andes-project/ui/components/pagination";
import {
	previewState,
	StateMatrix,
} from "@hack-the-andes-project/ui/components/showcase/state-matrix";
import { ShowcaseTier } from "@hack-the-andes-project/ui/components/showcase/tier";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarProvider,
	SidebarRail,
	SidebarTrigger,
} from "@hack-the-andes-project/ui/components/sidebar";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@hack-the-andes-project/ui/components/table";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@hack-the-andes-project/ui/components/tabs";
import { toast } from "sonner";
import { getShowcaseStateLabels, SHOWCASE_SECTIONS } from "@/constants";
import { m } from "@/paraglide/messages";

export function NavigationShowcase() {
	return (
		<ShowcaseTier
			id="components-navigation"
			title={m.ds_tier_navigation()}
			description={m.ds_tier_navigation_description()}
		>
			<div className="flex min-w-0 flex-col gap-4 rounded-lg border p-5">
				<h3 className="type-heading">{m.ds_tabs_title()}</h3>
				<Tabs defaultValue="now">
					<TabsList aria-label={m.ds_alert_horizon()}>
						<TabsTrigger value="now">{m.horizon_now()}</TabsTrigger>
						<TabsTrigger value="forecast">{m.ds_forecast_window()}</TabsTrigger>
						<TabsTrigger value="history" disabled>
							{m.ds_history()}
						</TabsTrigger>
					</TabsList>
					<TabsContent value="now">
						<Table>
							<TableCaption>{m.ds_confirmed_incidents_caption()}</TableCaption>
							<TableHeader>
								<TableRow>
									<TableHead>{m.ds_route_label()}</TableHead>
									<TableHead>{m.ds_status_label()}</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								<TableRow>
									<TableCell>{m.ds_central_kilometer()}</TableCell>
									<TableCell>
										<Badge variant="critical">{m.risk_critical()}</Badge>
									</TableCell>
								</TableRow>
								<TableRow>
									<TableCell>{m.ds_panamericana_sur()}</TableCell>
									<TableCell>
										<Badge variant="low">{m.risk_low()}</Badge>
									</TableCell>
								</TableRow>
							</TableBody>
						</Table>
					</TabsContent>
					<TabsContent value="forecast">
						<p className="py-4">{m.ds_forecast_tab_description()}</p>
					</TabsContent>
				</Tabs>
			</div>
			<Breadcrumb>
				<BreadcrumbList>
					<BreadcrumbItem>
						<BreadcrumbLink href="#design-system">
							{m.app_title()}
						</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbLink href="#panel">{m.ds_panel_title()}</BreadcrumbLink>
					</BreadcrumbItem>
					<BreadcrumbSeparator />
					<BreadcrumbItem>
						<BreadcrumbPage>{m.ds_carretera_central()}</BreadcrumbPage>
					</BreadcrumbItem>
				</BreadcrumbList>
			</Breadcrumb>
			<div className="flex flex-wrap gap-6">
				<NavigationMenu>
					<NavigationMenuList>
						<NavigationMenuItem>
							<NavigationMenuTrigger>{m.ds_sources()}</NavigationMenuTrigger>
							<NavigationMenuContent>
								<NavigationMenuLink href="#riesgo">
									{m.ds_confirmed_source()}
								</NavigationMenuLink>
								<NavigationMenuLink href="#datos">
									{m.ds_senamhi_orange_warning()}
								</NavigationMenuLink>
							</NavigationMenuContent>
						</NavigationMenuItem>
						<NavigationMenuItem>
							<NavigationMenuLink href="#panel">
								{m.ds_panel_title()}
							</NavigationMenuLink>
						</NavigationMenuItem>
					</NavigationMenuList>
				</NavigationMenu>
				<Menubar>
					<MenubarMenu>
						<MenubarTrigger>{m.ds_route_actions()}</MenubarTrigger>
						<MenubarContent>
							<MenubarGroup>
								<MenubarItem
									onClick={() => toast.success(m.ds_toast_monitor_enabled())}
								>
									{m.ds_monitor_route()}
								</MenubarItem>
								<MenubarItem
									onClick={() => toast.info(m.ds_toast_source_opened())}
								>
									{m.ds_view_sources()}
								</MenubarItem>
							</MenubarGroup>
						</MenubarContent>
					</MenubarMenu>
				</Menubar>
			</div>
			<Pagination aria-label={m.ds_route_pages()}>
				<PaginationContent>
					<PaginationItem>
						<PaginationPrevious
							href="#panel"
							text={m.ds_previous()}
							aria-label={m.ds_previous()}
						/>
					</PaginationItem>
					<PaginationItem>
						<PaginationLink href="#panel" isActive>
							1
						</PaginationLink>
					</PaginationItem>
					<PaginationItem>
						<PaginationLink href="#panel">2</PaginationLink>
					</PaginationItem>
					<PaginationItem>
						<PaginationNext
							href="#panel"
							text={m.ds_next()}
							aria-label={m.ds_next()}
						/>
					</PaginationItem>
				</PaginationContent>
			</Pagination>
			<DirectionProvider direction="ltr">
				<div className="relative isolate overflow-hidden rounded-lg border">
					<SidebarProvider defaultOpen className="relative h-128 min-h-0">
						<Sidebar collapsible="icon" className="absolute h-full">
							<SidebarHeader>
								<SidebarMenu>
									<SidebarMenuItem>
										<SidebarMenuButton
											tooltip={m.app_title()}
											render={<a href="#componentes" />}
											aria-label={m.app_title()}
										>
											<CloudLightningIcon />
											<span className="type-heading">{m.app_title()}</span>
										</SidebarMenuButton>
									</SidebarMenuItem>
								</SidebarMenu>
								<SidebarTrigger aria-label={m.sidebar_toggle()} />
							</SidebarHeader>
							<SidebarContent>
								<SidebarGroup>
									<SidebarGroupLabel>{m.ds_workspace()}</SidebarGroupLabel>
									<SidebarGroupContent>
										<SidebarMenu>
											{SHOWCASE_SECTIONS.map((section) => (
												<SidebarMenuItem key={section.id}>
													<SidebarMenuButton
														render={<a href={`#${section.id}`} />}
														isActive={section.id === "panel"}
														tooltip={section.label()}
														aria-label={section.label()}
													>
														<MapPinIcon />
														<span>{section.label()}</span>
													</SidebarMenuButton>
												</SidebarMenuItem>
											))}
										</SidebarMenu>
									</SidebarGroupContent>
								</SidebarGroup>
							</SidebarContent>
							<SidebarFooter>
								<p className="type-label group-data-[collapsible=icon]:hidden">
									{m.ds_operations()}
								</p>
							</SidebarFooter>
							<SidebarRail
								aria-label={m.sidebar_toggle()}
								title={m.sidebar_toggle()}
							/>
						</Sidebar>
						<div className="flex min-w-0 flex-1 flex-col gap-4 p-6">
							<SidebarTrigger
								className="md:hidden"
								aria-label={m.sidebar_toggle()}
							/>
							<h4 className="type-heading">{m.ds_panel_title()}</h4>
							<p className="type-body text-muted-foreground">
								{m.ds_sidebar_description()}
							</p>
							<p className="type-body">{m.ds_route_card_alert()}</p>
							<Badge variant="critical">{m.risk_critical()}</Badge>
						</div>
					</SidebarProvider>
				</div>
			</DirectionProvider>

			<StateMatrix
				variantLabel={m.ds_variant()}
				stateLabels={getShowcaseStateLabels()}
				rows={["default", "line"]}
				render={(variant, state) => (
					<Tabs defaultValue="now">
						<TabsList
							variant={variant === "line" ? "line" : "default"}
							aria-label={m.ds_alert_horizon()}
						>
							<TabsTrigger value="now" {...previewState(state)}>
								{m.horizon_now()}
							</TabsTrigger>
							<TabsTrigger value="forecast" disabled={state === "disabled"}>
								{m.ds_forecast_window()}
							</TabsTrigger>
						</TabsList>
						<TabsContent value="now" className="sr-only">
							{m.ds_route_card_alert()}
						</TabsContent>
						<TabsContent value="forecast" className="sr-only">
							{m.ds_heavy_rain_forecast()}
						</TabsContent>
					</Tabs>
				)}
			/>
			<DirectionProvider direction="rtl">
				<div dir="rtl" className="flex flex-col gap-3 rounded-lg border p-5">
					<p className="type-label">{m.ds_rtl_preview()}</p>
					<Breadcrumb>
						<BreadcrumbList>
							<BreadcrumbItem>
								<BreadcrumbLink href="#panel">
									{m.ds_panel_title()}
								</BreadcrumbLink>
							</BreadcrumbItem>
							<BreadcrumbSeparator />
							<BreadcrumbItem>
								<BreadcrumbPage>{m.ds_sample_route_code()}</BreadcrumbPage>
							</BreadcrumbItem>
						</BreadcrumbList>
					</Breadcrumb>
				</div>
			</DirectionProvider>
		</ShowcaseTier>
	);
}
