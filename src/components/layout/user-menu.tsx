"use client";

import { useRouter } from "next/navigation";
import { LogOut, User as UserIcon, Settings } from "lucide-react";
import { useAuthStore } from "@/stores/auth.store";
import { useCurrentRole, usePermissions } from "@/hooks/use-permissions";
import { ADMIN_SECTIONS } from "@/constants/navigation";
import { initials } from "@/lib/format";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const role = useCurrentRole();
  const { can } = usePermissions();

  // Profile is the personal landing; "Settings" opens the configuration area —
  // the first admin section the role can access (Organization for admins),
  // falling back to a personal settings page when the role has no admin perms.
  const settingsHref =
    ADMIN_SECTIONS.flatMap((group) => group.items).find((item) =>
      can(item.permission),
    )?.href ?? "/settings/appearance";

  if (!user) return null;

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="size-9 rounded-full"
            aria-label="Account menu"
          />
        }
      >
        <Avatar className="size-7">
          <AvatarImage src={user.avatarUrl} alt={user.name} />
          <AvatarFallback className="text-xs">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center gap-2.5 px-2 py-1.5">
          <Avatar className="size-9 shrink-0">
            <AvatarImage src={user.avatarUrl} alt={user.name} />
            <AvatarFallback className="text-xs">
              {initials(user.name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium">{user.name}</span>
            <span className="truncate text-xs text-muted-foreground">
              {role?.name ?? "No role"}
            </span>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => router.push("/settings/profile")}
          className="gap-3 px-2.5 py-2.5 text-base"
        >
          <UserIcon className="size-5" /> Profile
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => router.push(settingsHref)}
          className="gap-3 px-2.5 py-2.5 text-base"
        >
          <Settings className="size-5" /> Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={handleLogout}
          className="gap-3 px-2.5 py-2.5 text-base"
        >
          <LogOut className="size-5" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
