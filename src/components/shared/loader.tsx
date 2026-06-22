import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Loader({
  className,
  label,
}: {
  className?: string;
  label?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col items-center justify-center gap-3 p-10 text-muted-foreground",
        className,
      )}
    >
      <Loader2 className="size-6 animate-spin" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}
