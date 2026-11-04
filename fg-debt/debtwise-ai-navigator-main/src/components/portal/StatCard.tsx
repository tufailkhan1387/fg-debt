import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "warning" | "deep";
  children?: ReactNode;
}) {
  const tones: Record<string, string> = {
    default: "bg-card",
    positive: "bg-card",
    warning: "bg-card",
    deep: "gradient-deep text-primary-foreground border-transparent",
  };
  const iconTone: Record<string, string> = {
    default: "bg-secondary/60 text-primary",
    positive: "bg-success/12 text-success",
    warning: "bg-warning/18 text-warning",
    deep: "bg-primary-foreground/12 text-accent",
  };
  return (
    <div className={`surface-card hover-lift p-5 ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p
            className={`text-xs font-medium uppercase tracking-[0.12em] ${
              tone === "deep" ? "text-primary-foreground/70" : "text-muted-foreground"
            }`}
          >
            {label}
          </p>
          <p className="mt-2 font-display text-2xl font-semibold tabular-nums">{value}</p>
          {hint && (
            <p
              className={`mt-1 text-xs ${tone === "deep" ? "text-primary-foreground/70" : "text-muted-foreground"}`}
            >
              {hint}
            </p>
          )}
        </div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${iconTone[tone]}`}>
          <Icon className="size-5" />
        </span>
      </div>
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}
