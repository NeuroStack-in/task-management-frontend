"use client";

import { useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { useAvatarStore } from "@/stores/avatars.store";

interface UserAvatarProps {
  /**
   * The employee's user id. When absent — a row that only carries a display name, which several
   * read-models do — this renders initials and asks for nothing. A photo needs an id; there is no
   * lookup by name, and inventing one would be a directory-enumeration surface.
   */
  userId?: string | null;
  /** Display name, for the initials fallback and the image's alt text. */
  name: string;
  className?: string;
  fallbackClassName?: string;
  size?: "default" | "sm" | "lg";
}

/**
 * A person's avatar, anywhere in the app.
 *
 * Every surface that shows people — timesheets, project members, task assignees, attendance,
 * locations, the dashboard — previously hand-rolled `<Avatar><AvatarImage/><AvatarFallback>` and
 * had no URL to pass, so all of them rendered initials no matter what the person had uploaded.
 * Fixing that per component would have meant a fetch in each, and the same photo requested five
 * times on one page.
 *
 * This resolves from {@link useAvatarStore}: one shared session cache, one batched request per
 * burst of new ids, and initials whenever there is no photo, no id, or the lookup failed. Callers
 * pass an id and a name and get the right thing without knowing any of that.
 */
export function UserAvatar({
  userId,
  name,
  className,
  fallbackClassName,
  size,
}: UserAvatarProps) {
  const ensure = useAvatarStore((s) => s.ensure);
  const url = useAvatarStore((s) => (userId ? s.urls[userId] : undefined));

  // In an effect, not in render: `ensure` writes to the store, and a store write during render is
  // exactly the "cannot update a component while rendering a different component" warning — and,
  // with a selector returning a fresh value, the infinite loop that took the employee profile page
  // down earlier today.
  useEffect(() => {
    if (userId) ensure([userId]);
  }, [userId, ensure]);

  return (
    <Avatar className={className} size={size}>
      <AvatarImage src={url} alt={name} />
      <AvatarFallback className={fallbackClassName}>
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}
