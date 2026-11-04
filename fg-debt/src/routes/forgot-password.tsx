import { createFileRoute, Link } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app-mode";
import { useState } from "react";
import { ArrowLeft, Loader2, MailCheck, Send } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { forgotPasswordRequest } from "@/lib/auth-api";
import { toast } from "sonner";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: `Reset your password — ${APP_NAME}` },
      { name: "description", content: `Request a secure password reset link for your ${APP_NAME} account.` },
      { property: "og:title", content: `Reset your password — ${APP_NAME}` },
      { property: "og:description", content: `Request a secure password reset link for your ${APP_NAME} account.` },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [resetHref, setResetHref] = useState("/reset-password");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await forgotPasswordRequest(email);
      if (result.resetUrl) {
        const parsed = new URL(result.resetUrl, window.location.origin);
        setResetHref(`${parsed.pathname}${parsed.search}`);
      } else if (result.token) {
        setResetHref(`/reset-password?token=${encodeURIComponent(result.token)}`);
      }
      setSent(true);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to send a reset link.";
      toast.error("Request failed", { description: message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="We'll email you a secure link to set a new one. The link expires in 30 minutes."
      footer={
        <Link to="/login" className="inline-flex items-center gap-2 font-medium text-foreground">
          <ArrowLeft className="size-4" /> Back to sign in
        </Link>
      }
    >
      {sent ? (
        <div className="surface-card animate-rise p-6 text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-success/12 text-success">
            <MailCheck className="size-6" />
          </span>
          <h2 className="mt-4 text-lg font-semibold">Check your inbox</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            If an account exists for that address, a reset link is on its way.
          </p>
          <Button asChild variant="outline" className="mt-5 w-full">
            <a href={resetHref}>Open reset link (demo)</a>
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="email">Email address</Label>
            <Input id="email" name="email" type="email" placeholder="you@example.co.uk" />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            {loading ? "Sending link…" : "Send reset link"}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
