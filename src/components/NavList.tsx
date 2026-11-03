import {
	AtSign,
	Briefcase,
	CircleUser,
	FolderKanban,
	GraduationCap,
	HeartPulse,
	History,
	Images,
	Inbox,
	LayoutDashboard,
	type LucideIcon,
	MessageSquare,
	UserRound,
	Wrench,
} from "lucide-react";
import { NAV, type NavIcon } from "@/lib/nav";
import { cn } from "@/lib/utils";

const ICONS: Record<NavIcon, LucideIcon> = {
	dashboard: LayoutDashboard,
	inbox: Inbox,
	comments: MessageSquare,
	projects: FolderKanban,
	experience: Briefcase,
	education: GraduationCap,
	skills: Wrench,
	about: UserRound,
	media: Images,
	contact: AtSign,
	activity: History,
	status: HeartPulse,
	account: CircleUser,
};

interface Props {
	activeId: string;
	/** Numeros de los globos (`mensajes`, `comentarios`); 0 o ausente = sin globo. */
	badges?: Record<string, number>;
}

/**
 * Menu principal. Es el mismo componente en el lateral (servidor, sin
 * hidratar) y dentro del `Sheet` del movil (isla).
 */
export const NavList = ({ activeId, badges = {} }: Props) => (
	<nav aria-label="Principal" className="flex flex-col gap-5">
		{NAV.map((group) => (
			<div key={group.label ?? "inicio"} className="flex flex-col gap-1">
				{group.label ? (
					<p className="eyebrow px-3 pb-1">{group.label}</p>
				) : null}
				<ul className="flex flex-col gap-0.5">
					{group.items.map((item) => {
						const Icon = ICONS[item.icon];
						const active = item.id === activeId;
						const count = badges[item.id] ?? 0;
						return (
							<li key={item.id}>
								<a
									href={item.href}
									aria-current={active ? "page" : undefined}
									className={cn(
										"relative flex min-h-11 items-center gap-3 rounded-md px-3 text-[0.9375rem] font-medium text-muted-foreground transition-colors",
										"hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
										active &&
											"bg-muted text-foreground before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-primary",
									)}
								>
									<Icon
										aria-hidden="true"
										className="size-[1.125rem] shrink-0"
									/>
									<span>{item.label}</span>
									{count > 0 ? (
										<span className="ml-auto rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-primary-foreground">
											<span className="sr-only">Sin atender: </span>
											{count > 99 ? "99+" : count}
										</span>
									) : null}
								</a>
							</li>
						);
					})}
				</ul>
			</div>
		))}
	</nav>
);
