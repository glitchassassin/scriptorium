import { cn } from "~/lib/cn";

type UnreadBadgeProps = {
  variant?: "solid" | "hollow";
};

export function UnreadBadge({ variant = "solid" }: UnreadBadgeProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-block box-border size-2 rounded-full",
        variant === "solid" ? "bg-black" : "border-2 border-black bg-transparent",
      )}
      data-testid="unread-badge"
    />
  );
}
