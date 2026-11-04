import { type LucideIcon } from "lucide-react";
import { Link } from "@tanstack/react-router";

export interface SolicitorStatCardProps {
  label: string;
  value: number | string;
  icon: LucideIcon;
  trend?: string;
  description?: string;
  statusColor?: "emerald" | "amber" | "rose" | "blue" | "purple";
  onClick?: () => void;
  active?: boolean;
}

export function SolicitorStatCard({
  label,
  value,
  icon: Icon,
  trend,
  description,
  statusColor = "blue",
  onClick,
  active,
}: SolicitorStatCardProps) {
  const colorStyles = {
    emerald: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    amber: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    blue: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    purple: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20",
  };

  const badgeStyles = {
    emerald: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    amber: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    rose: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
    blue: "bg-blue-500/15 text-blue-700 dark:text-blue-300",
    purple: "bg-purple-500/15 text-purple-700 dark:text-purple-300",
  };

  return (
    <button
      onClick={onClick}
      className={`group relative flex flex-col justify-between rounded-2xl border p-4.5 text-left transition-all duration-300 ${
        active
          ? "border-primary bg-primary/5 shadow-lift ring-2 ring-primary/20"
          : "border-border bg-card hover:-translate-y-1 hover:border-primary/40 hover:shadow-soft"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <span className={`grid size-11 place-items-center rounded-full border ${colorStyles[statusColor]} transition-transform group-hover:scale-105 shadow-soft`}>
          <Icon className="size-5" />
        </span>
        {trend && (
          <span className={`rounded-full px-3 py-1 text-[0.7rem] font-semibold leading-tight ${badgeStyles[statusColor]}`}>
            {trend}
          </span>
        )}
      </div>

      <div className="mt-4">
        <div className="text-2xl font-display font-bold tracking-tight text-foreground">
          {value}
        </div>
        <p className="text-xs font-semibold text-muted-foreground mt-0.5 group-hover:text-foreground transition-colors">
          {label}
        </p>
        {description && (
          <p className="text-[0.68rem] text-muted-foreground/80 mt-1 line-clamp-1">
            {description}
          </p>
        )}
      </div>
    </button>
  );
}
