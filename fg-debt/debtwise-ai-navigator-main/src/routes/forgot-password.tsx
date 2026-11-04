import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowLeft, Loader2, MailCheck, Send } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — FG Debt Advisor AI" },
      { name: "description", content: "Request a secure password reset link for your FG Debt Advisor AI debt advice account." },
      { property: "og:title", content: "Reset your password — FG Debt Advisor AI" },
      { property: "og:description", content: "Request a secure password reset link for your FG Debt Advisor AI account." },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }
    setError("");
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setSent(true);
    }, 900);
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
            <Link to="/reset-password">Open reset link (demo)</Link>
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
