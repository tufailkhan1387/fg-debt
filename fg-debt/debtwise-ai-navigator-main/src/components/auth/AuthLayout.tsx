import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/Logo";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden gradient-deep p-12 text-primary-foreground lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-accent/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-20 size-80 rounded-full bg-secondary/20 blur-3xl" />
        <Logo inverted />
        <div className="relative mt-auto max-w-md">
          <h2 className="font-display text-3xl font-semibold leading-tight">
            Regulated debt advice, accelerated by AI.
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-primary-foreground/75">
            Complete one structured assessment and FG Debt Advisor AI builds your financial statement, matches
            the right debt solution and routes it to a qualified solicitor for approval.
          </p>
          <ul className="mt-8 space-y-3 text-sm">
            {[
              "17-step guided assessment with save-as-you-go",
              "Solicitor-reviewed recommendations, never automated approval",
              "Encrypted document vault and identity verification",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-primary-foreground/85">
                <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-10 flex items-center gap-2 text-xs text-primary-foreground/60">
            <ShieldCheck className="size-4 text-accent" /> FCA-aligned processes · 256-bit encryption
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-md animate-rise">
          <div className="mb-8 lg:hidden">
            <Logo />
          </div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-muted-foreground">{footer}</div>}
          <p className="mt-10 text-xs text-muted-foreground">
            By continuing you agree to our{" "}
            <Link to="/" className="underline underline-offset-4 hover:text-foreground">
              terms and privacy policy
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
