import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/brand/Logo";
import { COMPLIANCE_ONLY } from "@/lib/app-mode";

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
        <div className="relative z-10">
          <Logo inverted />
        </div>
        <div className="relative z-10 flex flex-1 flex-col justify-center">
          <div className="max-w-md text-left">
            {COMPLIANCE_ONLY ? (
              <>
                <h2 className="font-display text-3xl font-semibold leading-tight">
                  The firm's compliance, in one place.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-primary-foreground/75">
                  Policies, risks, review dates and approvals for Frantz Gregory &amp; Co — kept secure and ready for
                  SQM and SRA review.
                </p>
              </>
            ) : (
              <>
                <h2 className="font-display text-3xl font-semibold leading-tight">
                  Regulated debt advice, accelerated by AI.
                </h2>
                <p className="mt-4 text-sm leading-relaxed text-primary-foreground/75">
                  Complete one structured assessment and FG Debt Advisor AI builds your financial statement, matches
                  the right debt solution and routes it to a qualified solicitor for approval.
                </p>
              </>
            )}
          </div>
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
          {/* The terms link points at the Debt Advisor landing page, which is hidden in compliance-only mode. */}
          {!COMPLIANCE_ONLY && (
            <p className="mt-10 text-xs text-muted-foreground">
              By continuing you agree to our{" "}
              <Link to="/" className="underline underline-offset-4 hover:text-foreground">
                terms and privacy policy
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
