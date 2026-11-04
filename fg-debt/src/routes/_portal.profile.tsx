import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Bell, KeyRound, Loader2, Mail, MapPin, Phone, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useClientPortal, type ClientPortalCustomer } from "@/lib/client-portal-api";
import { ClientPortalError, ClientPortalLoading } from "@/lib/client-portal-page";
import {
  DEFAULT_CLIENT_NOTIFICATION_PREFS,
  passwordChangeErrorMessage,
  privacyRequestErrorMessage,
  profileUpdateErrorMessage,
  useChangeClientPassword,
  useClientNotificationPrefs,
  useClientPrivacyRequests,
  useRequestClientAccountClosure,
  useRequestClientDataExport,
  useUpdateClientNotificationPrefs,
  useUpdateClientProfile,
  type ClientNotificationPrefs,
} from "@/lib/client-profile-api";
import { useClientVerification, verificationStatusLabel } from "@/lib/client-verification-api";

export const Route = createFileRoute("/_portal/profile")({
  head: () => ({
    meta: [
      { title: "Profile & Settings — FG Debt Advisor AI" },
      {
        name: "description",
        content: "Manage your personal details, security settings, notification preferences and data rights.",
      },
      { property: "og:title", content: "Profile & Settings — FG Debt Advisor AI" },
      { property: "og:description", content: "Your FG Debt Advisor AI account details and privacy controls." },
    ],
  }),
  component: ProfilePage,
});

type ProfileFormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
};

function toFormState(customer: ClientPortalCustomer): ProfileFormState {
  return {
    firstName: customer.firstName,
    lastName: customer.lastName,
    email: customer.email,
    phone: customer.phone,
    address: customer.address,
  };
}

function ProfilePage() {
  const { data, isLoading, isError } = useClientPortal();
  const verificationQuery = useClientVerification();

  if (isLoading || verificationQuery.isLoading) return <ClientPortalLoading />;
  if (isError || !data) return <ClientPortalError />;

  return (
    <ProfileContent
      customer={data.portal.customer}
      verificationStatus={verificationQuery.data?.overallStatus ?? "pending"}
    />
  );
}

function ProfileContent({
  customer,
  verificationStatus,
}: {
  customer: ClientPortalCustomer;
  verificationStatus: "verified" | "in_review" | "pending" | "failed";
}) {
  const updateProfile = useUpdateClientProfile();
  const changePassword = useChangeClientPassword();
  const [form, setForm] = useState<ProfileFormState>(() => toFormState(customer));
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    setForm(toFormState(customer));
  }, [customer]);

  const identityLabel = verificationStatusLabel(verificationStatus);
  const identityVerified = verificationStatus === "verified";

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    updateProfile.mutate(form, {
      onSuccess: () => toast.success("Your details have been updated"),
      onError: (error) => toast.error(profileUpdateErrorMessage(error)),
    });
  };

  const resetForm = () => setForm(toFormState(customer));

  const updatePassword = () => {
    changePassword.mutate(passwordForm, {
      onSuccess: () => {
        toast.success("Password updated");
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      },
      onError: (error) => toast.error(passwordChangeErrorMessage(error)),
    });
  };

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title="Profile & settings"
        description="Keep your details accurate — your case outcome depends on the information we hold about you."
      />

      <div className="surface-card mb-6 flex flex-wrap items-center gap-5 p-6">
        <span className="grid size-16 place-items-center rounded-2xl gradient-deep font-display text-xl font-semibold text-primary-foreground">
          {customer.initials}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-semibold">
            {customer.firstName} {customer.lastName}
          </h2>
          <p className="text-sm text-muted-foreground">
            Client reference {customer.reference} · Member since {customer.memberSince}
          </p>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
            identityVerified
              ? "border-success/25 bg-success/12 text-success"
              : verificationStatus === "failed"
                ? "border-warning/25 bg-warning/12 text-warning"
                : "border-border bg-muted/40 text-muted-foreground"
          }`}
        >
          <BadgeCheck className="size-3.5" /> Identity {identityLabel.toLowerCase()}
        </span>
      </div>

      <Tabs defaultValue="details">
        <TabsList className="mb-6">
          <TabsTrigger value="details">Personal details</TabsTrigger>
          <TabsTrigger value="security">Security</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="privacy">Privacy</TabsTrigger>
        </TabsList>

        <TabsContent value="details">
          <form onSubmit={save} className="surface-card max-w-3xl p-6">
            <h3 className="text-lg font-semibold">Contact information</h3>
            <p className="text-sm text-muted-foreground">
              Changes to your name or address may require re-verification.
            </p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="first">First name</Label>
                <Input
                  id="first"
                  value={form.firstName}
                  onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last">Last name</Label>
                <Input
                  id="last"
                  value={form.lastName}
                  onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={form.email}
                    onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                    className="pl-9"
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile number</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={form.phone}
                    onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Home address</Label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
            <Separator className="my-6" />
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
              <Button type="button" variant="outline" disabled={updateProfile.isPending} onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </form>
        </TabsContent>

        <TabsContent value="security">
          <div className="grid max-w-3xl gap-6">
            <section className="surface-card p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <KeyRound className="size-4 text-accent" /> Password
              </h3>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="current">Current password</Label>
                  <Input
                    id="current"
                    type="password"
                    placeholder="••••••••••"
                    value={passwordForm.currentPassword}
                    onChange={(event) =>
                      setPasswordForm((current) => ({ ...current, currentPassword: event.target.value }))
                    }
                    autoComplete="current-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new">New password</Label>
                  <Input
                    id="new"
                    type="password"
                    placeholder="••••••••••"
                    value={passwordForm.newPassword}
                    onChange={(event) =>
                      setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
                    }
                    autoComplete="new-password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="••••••••••"
                    value={passwordForm.confirmPassword}
                    onChange={(event) =>
                      setPasswordForm((current) => ({ ...current, confirmPassword: event.target.value }))
                    }
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <Button className="mt-5" disabled={changePassword.isPending} onClick={updatePassword}>
                {changePassword.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Updating…
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </section>

            <section className="surface-card p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <ShieldCheck className="size-4 text-accent" /> Two-factor authentication
              </h3>
              <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-medium">SMS verification</p>
                  <p className="text-xs text-muted-foreground">Codes sent to {customer.phone || form.phone || "your mobile"}</p>
                </div>
                <Switch defaultChecked aria-label="Toggle SMS two-factor authentication" />
              </div>
              <div className="mt-3 flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-medium">Authenticator app</p>
                  <p className="text-xs text-muted-foreground">Time-based one-time passcodes</p>
                </div>
                <Switch aria-label="Toggle authenticator app" />
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="notifications">
          <NotificationPreferencesPanel />
        </TabsContent>

        <TabsContent value="privacy">
          <PrivacyRequestsPanel />
        </TabsContent>
      </Tabs>
    </>
  );
}

const NOTIFICATION_PREF_ITEMS = [
  ["email", "Email updates", "Case progress, solicitor decisions and document requests"],
  ["sms", "SMS alerts", "Urgent actions and verification codes"],
  ["ai", "AI insight digests", "Weekly summaries of your financial position"],
  ["marketing", "Service updates", "Occasional news about FG Debt Advisor AI features"],
] as const;

function NotificationPreferencesPanel() {
  const { data: prefs, isLoading, isError } = useClientNotificationPrefs();
  const updatePrefs = useUpdateClientNotificationPrefs();
  const activePrefs = prefs ?? DEFAULT_CLIENT_NOTIFICATION_PREFS;

  const setPref = (key: keyof ClientNotificationPrefs, value: boolean) => {
    const next = { ...activePrefs, [key]: value };
    updatePrefs.mutate(next, {
      onError: () => toast.error("Could not save notification preference"),
    });
  };

  return (
    <section className="surface-card max-w-3xl p-6">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <Bell className="size-4 text-accent" /> How we contact you
      </h3>
      {isLoading ? (
        <p className="mt-5 text-sm text-muted-foreground">Loading preferences…</p>
      ) : isError ? (
        <p className="mt-5 text-sm text-destructive">Could not load notification preferences.</p>
      ) : (
        <ul className="mt-5 space-y-3">
          {NOTIFICATION_PREF_ITEMS.map(([key, title, desc]) => (
            <li key={key} className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
              <div>
                <p className="text-sm font-medium">{title}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
              <Switch
                checked={activePrefs[key]}
                disabled={updatePrefs.isPending}
                onCheckedChange={(value) => setPref(key, value)}
                aria-label={title}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function PrivacyRequestsPanel() {
  const { data: requests, isLoading, isError } = useClientPrivacyRequests();
  const requestExport = useRequestClientDataExport();
  const requestClosure = useRequestClientAccountClosure();
  const [closureReason, setClosureReason] = useState("");

  const pendingExport = requests?.dataExports.find((item) => item.status === "pending") ?? null;
  const pendingClosure = requests?.accountClosure?.status === "pending" ? requests.accountClosure : null;

  const submitExport = () => {
    requestExport.mutate(undefined, {
      onSuccess: (result) => toast.success(result.message),
      onError: (error) => toast.error(privacyRequestErrorMessage(error)),
    });
  };

  const submitClosure = () => {
    requestClosure.mutate(closureReason, {
      onSuccess: (result) => {
        toast.success(result.message);
        setClosureReason("");
      },
      onError: (error) => toast.error(privacyRequestErrorMessage(error)),
    });
  };

  return (
    <div className="grid max-w-3xl gap-6">
      <section className="surface-card p-6">
        <h3 className="text-lg font-semibold">Your data rights</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Under UK GDPR you can request a copy of everything we hold about you at any time.
        </p>
        {isLoading ? (
          <p className="mt-4 text-sm text-muted-foreground">Loading privacy requests…</p>
        ) : isError ? (
          <p className="mt-4 text-sm text-destructive">Could not load privacy request status.</p>
        ) : pendingExport ? (
          <p className="mt-4 rounded-xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
            Data export <span className="font-semibold text-foreground">{pendingExport.id}</span> is pending since{" "}
            {pendingExport.requestedAt}. We will email your export within 30 days.
          </p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={requestExport.isPending || Boolean(pendingExport)}
            onClick={submitExport}
          >
            {requestExport.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" /> Submitting…
              </>
            ) : (
              "Request data export"
            )}
          </Button>
          <Button asChild variant="outline">
            <a href="/#gdpr" target="_blank" rel="noreferrer">
              View privacy notice
            </a>
          </Button>
        </div>
      </section>

      <section className="surface-card border-destructive/30 p-6">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-destructive">
          <Trash2 className="size-4" /> Close my account
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
          Closing your account ends all active cases. Regulatory rules require us to retain case records for six years,
          even after closure.
        </p>
        {pendingClosure ? (
          <p className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-muted-foreground">
            Account closure requested on {pendingClosure.requestedAt}. Our team will confirm next steps by email.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            <Label htmlFor="closure-reason">Reason (optional)</Label>
            <Input
              id="closure-reason"
              value={closureReason}
              onChange={(event) => setClosureReason(event.target.value)}
              placeholder="Tell us why you want to close your account"
            />
          </div>
        )}
        <Button
          variant="destructive"
          className="mt-5"
          disabled={requestClosure.isPending || Boolean(pendingClosure)}
          onClick={submitClosure}
        >
          {requestClosure.isPending ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Submitting…
            </>
          ) : (
            "Request account closure"
          )}
        </Button>
      </section>
    </div>
  );
}
