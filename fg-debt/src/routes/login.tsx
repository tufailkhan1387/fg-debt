import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Eye, EyeOff, Loader2, LogIn, ShieldCheck } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import {
  CLIENT_DEMO_CREDENTIALS,
  roleDisplayLabel,
  roleHomePath,
  setSession,
  SOLICITOR_DEMO_CREDENTIALS,
  type UserProfile,
} from "@/lib/auth";
import { loginRequest, verifyMfaRequest } from "@/lib/auth-api";
import { ApiError } from "@/lib/api";
import { getClientLandingPath } from "@/lib/assessment-guard";
import { isAssessmentComplete } from "@/lib/assessment-progress";
import { APP_NAME, COMPLIANCE_ONLY } from "@/lib/app-mode";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: COMPLIANCE_ONLY ? `Sign in — ${APP_NAME}` : "Sign in — FG Debt Advisor AI Legal & Client Portal" },
      {
        name: "description",
        content: COMPLIANCE_ONLY ? `Sign in to ${APP_NAME}.` : "Sign in to FG Debt Advisor AI for Client or Solicitor portals.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState("");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const finishSignIn = (user: UserProfile, token: string) => {
    // Client (debt advice) accounts have nothing to use while only the compliance system is shown.
    if (COMPLIANCE_ONLY && user.role === "client") {
      toast.error("Sign in failed", { description: `This account cannot be used with ${APP_NAME}.` });
      setMfaToken(null);
      return;
    }
    // Nothing loaded for whoever was signed in before (their access, their records) may show for this person.
    queryClient.clear();
    setSession(user, token);
    const destination = user.role === "client" ? getClientLandingPath() : roleHomePath(user.role);
    toast.success(`Welcome back, ${user.name}`, {
      description:
        user.role === "client" && !isAssessmentComplete()
          ? "Continue your debt assessment to unlock your dashboard."
          : `Signed in to ${roleDisplayLabel(user.role)}.`,
    });
    navigate({ to: destination as any });
  };

  const submitMfa = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!mfaToken || mfaCode.length !== 6) return;
    setLoading(true);
    try {
      const { user, token } = await verifyMfaRequest({ mfaToken, code: mfaCode });
      finishSignIn(user, token);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Unable to verify the code. Please try again.";
      toast.error("Verification failed", { description: message });
      setMfaCode("");
      if (error instanceof ApiError && error.code === "MFA_TOKEN_EXPIRED") {
        setMfaToken(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const next: typeof errors = {};
    if (!/^\S+@\S+\.\S+$/.test(email)) next.email = "Enter a valid email address.";
    if (password.length < 6) next.password = "Password must be at least 6 characters.";
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      const result = await loginRequest({ email, password, rememberMe });
      if ("mfaRequired" in result) {
        setMfaToken(result.mfaToken);
        setMfaCode("");
        return;
      }
      finishSignIn(result.user, result.token);
    } catch (error) {
      const message = error instanceof ApiError ? error.message : "Unable to sign in. Please try again.";
      toast.error("Sign in failed", { description: message });
    } finally {
      setLoading(false);
    }
  };

  if (mfaToken) {
    return (
      <AuthLayout
        title="Two-factor verification"
        subtitle="Enter the 6-digit code from your authenticator app."
        footer={
          <button
            type="button"
            onClick={() => setMfaToken(null)}
            className="font-semibold text-foreground underline underline-offset-4"
          >
            Back to sign in
          </button>
        }
      >
        <form onSubmit={submitMfa} className="space-y-5" noValidate>
          <div className="flex justify-center">
            <InputOTP maxLength={6} value={mfaCode} onChange={setMfaCode} autoFocus>
              <InputOTPGroup>
                {Array.from({ length: 6 }, (_, index) => (
                  <InputOTPSlot key={index} index={index} />
                ))}
              </InputOTPGroup>
            </InputOTP>
          </div>
          <Button type="submit" size="lg" className="w-full" disabled={loading || mfaCode.length !== 6}>
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
            {loading ? "Verifying…" : "Verify and sign in"}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={COMPLIANCE_ONLY ? `Sign in to ${APP_NAME}` : "Sign in to FG Debt Advisor AI"}
      subtitle="Enter your email and password to continue."
      footer={
        COMPLIANCE_ONLY ? (
          "Accounts are created by the firm's Principal."
        ) : (
          <>
            New to FG Debt Advisor AI?{" "}
            <Link to="/register" className="font-semibold text-foreground underline underline-offset-4">
              Create an account
            </Link>
          </>
        )
      }
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Demo logins</p>
          <p className="mt-1">
            {COMPLIANCE_ONLY ? "Principal" : "Solicitor"}:{" "}
            <span className="font-mono text-foreground">{SOLICITOR_DEMO_CREDENTIALS.email}</span>
            {" / "}
            <span className="font-mono text-foreground">{SOLICITOR_DEMO_CREDENTIALS.password}</span>
          </p>
          {!COMPLIANCE_ONLY && (
            <p>
              Customer:{" "}
              <span className="font-mono text-foreground">{CLIENT_DEMO_CREDENTIALS.email}</span>
              {" / "}
              <span className="font-mono text-foreground">{CLIENT_DEMO_CREDENTIALS.password}</span>
            </p>
          )}
        </div>

        <form onSubmit={submit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            name="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.co.uk"
            autoComplete="email"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={show ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
        </div>

        <label className="flex items-center gap-2.5 text-xs text-muted-foreground">
          <Checkbox
            id="remember"
            checked={rememberMe}
            onCheckedChange={(value) => setRememberMe(value === true)}
          />{" "}
          Keep me signed in on this device
        </label>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <LogIn className="size-4" />}
          {loading ? "Signing in…" : "Sign in"}
        </Button>
        </form>
      </div>
    </AuthLayout>
  );
}
