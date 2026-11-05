import { useState } from "react";
import { Copy, Loader2, ShieldCheck, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { ChangePasswordCard } from "@/components/compliance/ChangePasswordCard";
import { ApiError } from "@/lib/api";
import { getAuthToken, getCurrentUser, setSession, type UserProfile } from "@/lib/auth";
import { disableMfaRequest, enableMfaRequest, setupMfaRequest } from "@/lib/auth-api";

function errorMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "Please try again.";
}

function CodeInput({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <InputOTP maxLength={6} value={value} onChange={onChange}>
      <InputOTPGroup>
        {Array.from({ length: 6 }, (_, index) => (
          <InputOTPSlot key={index} index={index} />
        ))}
      </InputOTPGroup>
    </InputOTP>
  );
}

export function ComplianceSecurityPage() {
  const [user, setUser] = useState<UserProfile>(() => getCurrentUser());
  const [setup, setSetup] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const updateSessionUser = (next: UserProfile) => {
    const token = getAuthToken();
    if (token) setSession(next, token);
    setUser(next);
  };

  const startSetup = async () => {
    setBusy(true);
    try {
      setSetup(await setupMfaRequest());
      setCode("");
    } catch (error) {
      toast.error("Could not start setup", { description: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async (action: "enable" | "disable") => {
    setBusy(true);
    try {
      const { user: next } = action === "enable" ? await enableMfaRequest(code) : await disableMfaRequest(code);
      updateSessionUser(next);
      setSetup(null);
      setCode("");
      toast.success(action === "enable" ? "Two-factor authentication is on." : "Two-factor authentication is off.");
    } catch (error) {
      toast.error("Code not accepted", { description: errorMessage(error) });
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-6 pb-12">
      <div>
        <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">
          Two-Factor Security
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          With two-factor on, signing in needs your password and a 6-digit code from an authenticator app (Microsoft
          Authenticator, Google Authenticator or similar).
        </p>
      </div>

      <Card className="surface-card">
        <CardContent className="space-y-5 p-6">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Status</span>
            {user.mfaEnabled ? (
              <Badge variant="secondary" className="gap-1">
                <ShieldCheck className="size-3" /> On
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <ShieldOff className="size-3" /> Off
              </Badge>
            )}
          </div>

          {user.mfaEnabled && user.mfaRequired ? (
            <p className="text-sm text-muted-foreground">
              Your firm requires two-factor sign-in for your account, so it cannot be turned off here. If you lose your
              phone, ask a Principal to reset it.
            </p>
          ) : user.mfaEnabled ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">To turn it off, enter a current code from your app.</p>
              <CodeInput value={code} onChange={setCode} />
              <Button variant="outline" disabled={busy || code.length !== 6} onClick={() => confirm("disable")}>
                {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldOff className="size-4" />}
                Turn off two-factor
              </Button>
            </div>
          ) : setup ? (
            <div className="space-y-4">
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                <li>In your authenticator app, choose "Add account" and "Enter a setup key".</li>
                <li>
                  Use your email as the account name and this key:
                  <div className="mt-2 flex items-center gap-2">
                    <code className="rounded-md bg-muted px-2 py-1 font-mono text-sm text-foreground">
                      {setup.secret.match(/.{1,4}/g)?.join(" ")}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        void navigator.clipboard.writeText(setup.secret);
                        toast.success("Key copied.");
                      }}
                    >
                      <Copy className="size-4" />
                    </Button>
                  </div>
                  <span className="mt-1 block text-xs">
                    On a phone you can instead{" "}
                    <a href={setup.otpauthUrl} className="underline underline-offset-4">
                      open this link
                    </a>{" "}
                    to add it.
                  </span>
                </li>
                <li>Enter the 6-digit code the app shows.</li>
              </ol>
              <CodeInput value={code} onChange={setCode} />
              <div className="flex gap-2">
                <Button disabled={busy || code.length !== 6} onClick={() => confirm("enable")}>
                  {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
                  Turn on two-factor
                </Button>
                <Button variant="outline" onClick={() => setSetup(null)}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button onClick={startSetup} disabled={busy}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
              Set up two-factor
            </Button>
          )}
        </CardContent>
      </Card>

      <ChangePasswordCard />
    </div>
  );
}
