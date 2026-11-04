import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api";
import { changePasswordRequest } from "@/lib/auth-api";

/** Lets a signed-in firm user replace their password, e.g. the temporary one the Principal gave them. */
export function ChangePasswordCard() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [busy, setBusy] = useState(false);
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      await changePasswordRequest(form);
      toast.success("Password changed.");
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      toast.error("Password not changed", { description: error instanceof ApiError ? error.message : "Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="surface-card">
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            <KeyRound className="size-4 text-muted-foreground" /> Change password
          </h2>
          <p className="text-sm text-muted-foreground">If the Principal gave you a temporary password, replace it with your own. Use at least 8 characters.</p>
        </div>
        <form onSubmit={(e) => void submit(e)} className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label htmlFor="pw-current">Current password</Label>
            <Input id="pw-current" type="password" autoComplete="current-password" value={form.currentPassword} onChange={set("currentPassword")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-new">New password</Label>
            <Input id="pw-new" type="password" autoComplete="new-password" minLength={8} value={form.newPassword} onChange={set("newPassword")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw-confirm">Confirm new password</Label>
            <Input id="pw-confirm" type="password" autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} required />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={busy || !form.currentPassword || form.newPassword.length < 8 || form.newPassword !== form.confirmPassword}>
              {busy && <Loader2 className="size-4 animate-spin" />} Change password
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
