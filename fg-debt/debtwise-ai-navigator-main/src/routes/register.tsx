import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2, UserPlus } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create your account — FG Debt Advisor AI" },
      { name: "description", content: "Create a free FG Debt Advisor AI account and start your AI-guided debt assessment in minutes." },
      { property: "og:title", content: "Create your account — FG Debt Advisor AI" },
      { property: "og:description", content: "Start your AI-guided, solicitor-reviewed debt assessment." },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const [loading, setLoading] = useState(false);
  type Errors = { firstName?: string; lastName?: string; email?: string; password?: string; confirm?: string; terms?: string };
  const [errors, setErrors] = useState<Errors>({});
  const navigate = useNavigate();

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const next: Errors = {};
    if (!String(f.get("firstName") ?? "").trim()) next.firstName = "Enter your first name.";
    if (!String(f.get("lastName") ?? "").trim()) next.lastName = "Enter your last name.";
    if (!/^\S+@\S+\.\S+$/.test(String(f.get("email") ?? ""))) next.email = "Enter a valid email address.";
    if (String(f.get("password") ?? "").length < 8) next.password = "Use at least 8 characters.";
    if (f.get("password") !== f.get("confirm")) next.confirm = "Passwords do not match.";
    if (!f.get("terms")) next.terms = "Please accept the terms to continue.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      toast.success("Account created", { description: "Let's start your debt assessment." });
      navigate({ to: "/assessment" });
    }, 1000);
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="It takes two minutes. Your assessment saves automatically as you go."
      footer={
        <>
          Already registered?{" "}
          <Link to="/login" className="font-semibold text-foreground underline underline-offset-4">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-5" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" name="firstName" placeholder="Amelia" />
            {errors.firstName && <p className="text-xs text-destructive">{errors.firstName}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" name="lastName" placeholder="Hartley" />
            {errors.lastName && <p className="text-xs text-destructive">{errors.lastName}</p>}
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email address</Label>
          <Input id="email" name="email" type="email" placeholder="you@example.co.uk" />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Mobile number</Label>
          <Input id="phone" name="phone" type="tel" placeholder="07700 900312" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" placeholder="••••••••" />
            {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm">Confirm password</Label>
            <Input id="confirm" name="confirm" type="password" placeholder="••••••••" />
            {errors.confirm && <p className="text-xs text-destructive">{errors.confirm}</p>}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="flex items-start gap-2.5 text-sm text-muted-foreground">
            <Checkbox id="terms" name="terms" className="mt-0.5" />
            <span>I agree to the terms of service and understand my data is processed securely.</span>
          </label>
          {errors.terms && <p className="text-xs text-destructive">{errors.terms}</p>}
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
          {loading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </AuthLayout>
  );
}
