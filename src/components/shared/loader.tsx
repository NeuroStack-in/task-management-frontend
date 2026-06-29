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
        "flex flex-1 flex-col items-center justify-center gap-3 p-6 text-muted-foreground",
        className,
      )}
    >
      <div className="size-6 animate-spin rounded-full border-2 border-border border-t-primary" />
      {label ? <p className="text-sm">{label}</p> : null}
    </div>
  );
}
