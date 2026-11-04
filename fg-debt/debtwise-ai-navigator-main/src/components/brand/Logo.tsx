import { Link } from "@tanstack/react-router";
import { Scale } from "lucide-react";

export function Logo({ to = "/", inverted = false }: { to?: string; inverted?: boolean }) {
  return (
    <Link to={to} className="group inline-flex items-center gap-2.5">
      <span
        className={`grid size-9 place-items-center rounded-xl ${
          inverted ? "bg-accent text-accent-foreground" : "gradient-deep text-primary-foreground"
        } shadow-soft transition-transform group-hover:scale-105`}
      >
        <Scale className="size-4.5" strokeWidth={2} />
      </span>
      <span className="leading-tight">
        <span
          className={`block font-display text-[1.05rem] font-600 tracking-tight ${
            inverted ? "text-primary-foreground" : "text-foreground"
          }`}
        >
          FG Debt Advisor
        </span>
        <span
          className={`block text-[0.62rem] font-medium uppercase tracking-[0.18em] ${
            inverted ? "text-accent" : "text-muted-foreground"
          }`}
        >
          AI Debt Advice
        </span>
      </span>
    </Link>
  );
}
