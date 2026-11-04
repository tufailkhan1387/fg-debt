import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { APP_NAME } from "@/lib/app-mode";
import { useState } from "react";
import { Check, KeyRound, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { resetPasswordRequest } from "@/lib/auth-api";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: `Set a new password — ${APP_NAME}` },
      { name: "description", content: `Choose a new password for your ${APP_NAME} account.` },
      { property: "og:title", content: `Set a new password — ${APP_NAME}` },
      { property: "og:description", content: `Choose a new, strong password for your ${APP_NAME} account.` },
    ],
  }),
  component: ResetPasswordPage,
});

const rules = [
  { label: "At least 8 characters", test: (v: string) => v.length >= 8 },
  { label: "One uppercase letter", test: (v: string) => /[A-Z]/.test(v) },
  { label: "One number", test: (v: string) => /\d/.test(v) },
  { label: "One symbol", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
];

function ResetPasswordPage() {
  const [value, setValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const passed = rules.filter((r) => r.test(value)).length;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passed < rules.length) {
      setError("Your password does not meet all requirements yet.");
      return;
    }
    if (value !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    const token = new URLSearchParams(window.location.search).get("token") ?? "";
    if (!token) {
      setError("This reset link is missing a token. Request a new one from the forgot password page.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await resetPasswordRequest({ token, password: value });
      toast.success("Password updated", { description: "You can now sign in with your new password." });
      navigate({ to: "/login" });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Unable to update your password.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a strong password you haven't used elsewhere."
      footer={
        <Link to="/login" className="font-medium text-foreground underline underline-offset-4">
          Return to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
          <Input
            id="password"
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-accent transition-all duration-500"
            style={{ width: `${(passed / rules.length) * 100}%` }}
          />
        </div>
        <ul className="grid gap-2 sm:grid-cols-2">
          {rules.map((r) => {
            const ok = r.test(value);
            return (
              <li
                key={r.label}
                className={`flex items-center gap-2 text-xs ${ok ? "text-success" : "text-muted-foreground"}`}
              >
                <span
                  className={`grid size-4 place-items-center rounded-full border ${
                    ok ? "border-success bg-success/12" : "border-border"
                  }`}
                >
                  {ok && <Check className="size-2.5" />}
                </span>
                {r.label}
              </li>
            );
          })}
        </ul>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
          {loading ? "Updating…" : "Update password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
