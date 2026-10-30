import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@hack-the-andes-project/ui/components/alert-dialog";
import { Button } from "@hack-the-andes-project/ui/components/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@hack-the-andes-project/ui/components/command";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuGroup,
	ContextMenuItem,
	ContextMenuTrigger,
} from "@hack-the-andes-project/ui/components/context-menu";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@hack-the-andes-project/ui/components/dialog";
import {
	Drawer,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
	DrawerTrigger,
} from "@hack-the-andes-project/ui/components/drawer";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@hack-the-andes-project/ui/components/dropdown-menu";
import {
	HoverCard,
	HoverCardContent,
	HoverCardTrigger,
} from "@hack-the-andes-project/ui/components/hover-card";
import {
	Popover,
	PopoverContent,
	PopoverDescription,
	PopoverHeader,
	PopoverTitle,
	PopoverTrigger,
} from "@hack-the-andes-project/ui/components/popover";
import {
	Sheet,
	SheetClose,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@hack-the-andes-project/ui/components/sheet";
import { ArrowDownIcon } from "@hack-the-andes-project/ui/components/showcase/icons";
import { ShowcaseTier } from "@hack-the-andes-project/ui/components/showcase/tier";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@hack-the-andes-project/ui/components/tooltip";
import { useState } from "react";
import { toast } from "sonner";
import { ROUTE_EXAMPLES } from "@/constants";
import { m } from "@/paraglide/messages";

export function OverlaysShowcase() {
	const [archiveOpen, setArchiveOpen] = useState(false);
	const [commandOpen, setCommandOpen] = useState(false);
	const [selectedCommand, setSelectedCommand] = useState("none");
	return (
		<ShowcaseTier
			id="components-overlays"
			title={m.ds_tier_overlays()}
			description={m.ds_tier_overlays_description()}
		>
			<div className="flex flex-col gap-5">
				<h3 className="type-heading">{m.ds_overlays_title()}</h3>
				<div className="flex flex-wrap gap-3">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger render={<Button variant="outline" />}>
								{m.ds_forecast_tooltip_trigger()}
							</TooltipTrigger>
							<TooltipContent>{m.ds_forecast_tooltip()}</TooltipContent>
						</Tooltip>
					</TooltipProvider>
					<DropdownMenu>
						<DropdownMenuTrigger render={<Button variant="outline" />}>
							{m.ds_route_actions()}
							<ArrowDownIcon data-icon="inline-end" />
						</DropdownMenuTrigger>
						<DropdownMenuContent>
							<DropdownMenuGroup>
								<DropdownMenuLabel>
									{m.ds_carretera_central()}
								</DropdownMenuLabel>
								<DropdownMenuItem
									onClick={() => toast.success(m.ds_toast_monitor_enabled())}
								>
									{m.ds_monitor_route()}
								</DropdownMenuItem>
								<DropdownMenuItem
									onClick={() =>
										toast.info(m.ds_toast_reroute_recommendation())
									}
								>
									{m.ds_view_recommendation()}
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem
									variant="destructive"
									onClick={() => toast.info(m.ds_toast_alert_archived())}
								>
									{m.ds_archive_alert()}
								</DropdownMenuItem>
							</DropdownMenuGroup>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>
			<div className="flex flex-wrap gap-3">
				<Dialog>
					<DialogTrigger render={<Button variant="outline" />}>
						{m.ds_open_dialog()}
					</DialogTrigger>
					<DialogContent showCloseButton={false}>
						<DialogHeader>
							<DialogTitle>{m.ds_carretera_central()}</DialogTitle>
							<DialogDescription>{m.ds_route_card_alert()}</DialogDescription>
						</DialogHeader>
						<p className="type-body">{m.ds_assistant_message()}</p>
						<DialogFooter>
							<DialogClose render={<Button />}>{m.ds_close()}</DialogClose>
						</DialogFooter>
					</DialogContent>
				</Dialog>
				<AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}>
					<AlertDialogTrigger render={<Button variant="outline" />}>
						{m.ds_archive_alert()}
					</AlertDialogTrigger>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>{m.ds_archive_confirmation()}</AlertDialogTitle>
							<AlertDialogDescription>
								{m.ds_archive_description()}
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>{m.ds_cancel()}</AlertDialogCancel>
							<AlertDialogAction
								variant="destructive"
								onClick={() => {
									setArchiveOpen(false);
									toast.success(m.ds_toast_alert_archived());
								}}
							>
								{m.ds_confirm()}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
				<Sheet>
					<SheetTrigger render={<Button variant="outline" />}>
						{m.ds_open_sheet()}
					</SheetTrigger>
					<SheetContent showCloseButton={false}>
						<SheetHeader>
							<SheetTitle>{m.ds_carretera_central()}</SheetTitle>
							<SheetDescription>{m.ds_route_card_alert()}</SheetDescription>
						</SheetHeader>
						<p className="px-6 text-sm">{m.ds_assistant_message()}</p>
						<SheetFooter>
							<SheetClose render={<Button />}>{m.ds_close()}</SheetClose>
						</SheetFooter>
					</SheetContent>
				</Sheet>
				<Drawer>
					<DrawerTrigger render={<Button variant="outline" />}>
						{m.ds_open_drawer()}
					</DrawerTrigger>
					<DrawerContent>
						<DrawerHeader>
							<DrawerTitle>{m.ds_carretera_central()}</DrawerTitle>
							<DrawerDescription>{m.ds_route_card_alert()}</DrawerDescription>
						</DrawerHeader>
						<DrawerFooter>
							<DrawerClose render={<Button />}>{m.ds_close()}</DrawerClose>
						</DrawerFooter>
					</DrawerContent>
				</Drawer>
				<Popover>
					<PopoverTrigger render={<Button variant="outline" />}>
						{m.ds_open_popover()}
					</PopoverTrigger>
					<PopoverContent>
						<PopoverHeader>
							<PopoverTitle>{m.ds_carretera_central()}</PopoverTitle>
							<PopoverDescription>{m.ds_route_card_alert()}</PopoverDescription>
						</PopoverHeader>
					</PopoverContent>
				</Popover>
				<HoverCard>
					<HoverCardTrigger
						render={
							<a
								href="#riesgo"
								className="inline-flex items-center underline underline-offset-4"
							/>
						}
					>
						{m.ds_source_preview()}
					</HoverCardTrigger>
					<HoverCardContent>
						<p className="type-label">{m.ds_sources()}</p>
						<p className="mt-3 text-sm">{m.ds_source_summary()}</p>
					</HoverCardContent>
				</HoverCard>
				<Dialog open={commandOpen} onOpenChange={setCommandOpen}>
					<DialogTrigger render={<Button variant="outline" />}>
						{m.ds_open_command()}
					</DialogTrigger>
					<DialogContent showCloseButton={false}>
						<DialogHeader>
							<DialogTitle>{m.ds_search_route()}</DialogTitle>
							<DialogDescription>{m.ds_search_route_hint()}</DialogDescription>
						</DialogHeader>
						<Command value={selectedCommand} onValueChange={setSelectedCommand}>
							<CommandInput
								placeholder={m.ds_select_route()}
								aria-label={m.ds_search_route()}
							/>
							<CommandList>
								<CommandEmpty>{m.ds_no_route_matches()}</CommandEmpty>
								<CommandGroup heading={m.ds_panel_title()}>
									{ROUTE_EXAMPLES.map((route) => (
										<CommandItem
											key={route.id}
											value={route.id}
											keywords={[route.name()]}
											onSelect={() => {
												setCommandOpen(false);
												toast.info(route.name(), {
													description: route.recommendation(),
												});
											}}
										>
											{route.name()}
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
						<DialogFooter>
							<DialogClose render={<Button variant="outline" />}>
								{m.ds_close()}
							</DialogClose>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			</div>
			<ContextMenu>
				<ContextMenuTrigger
					className="flex min-h-24 items-center justify-center rounded-lg border border-dashed p-6 text-center text-sm"
					tabIndex={0}
				>
					{m.ds_context_actions()}
				</ContextMenuTrigger>
				<ContextMenuContent>
					<ContextMenuGroup>
						<ContextMenuItem
							onClick={() => toast.success(m.ds_toast_monitor_enabled())}
						>
							{m.ds_monitor_route()}
						</ContextMenuItem>
						<ContextMenuItem
							onClick={() => toast.info(m.ds_toast_reroute_recommendation())}
						>
							{m.ds_view_recommendation()}
						</ContextMenuItem>
					</ContextMenuGroup>
				</ContextMenuContent>
			</ContextMenu>
		</ShowcaseTier>
	);
}
