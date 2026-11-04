import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Bell, KeyRound, Mail, MapPin, Phone, ShieldCheck, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/portal/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { customer } from "@/lib/mock-data";

export const Route = createFileRoute("/_portal/profile")({
  head: () => ({
    meta: [
      { title: "Profile & Settings — FG Debt Advisor AI" },
      { name: "description", content: "Manage your personal details, security settings, notification preferences and data rights." },
      { property: "og:title", content: "Profile & Settings — FG Debt Advisor AI" },
      { property: "og:description", content: "Your FG Debt Advisor AI account details and privacy controls." },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const [saving, setSaving] = useState(false);
  const [prefs, setPrefs] = useState({ email: true, sms: true, ai: false, marketing: false });

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast.success("Your details have been updated");
    }, 900);
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
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success/25 bg-success/12 px-3 py-1.5 text-xs font-semibold text-success">
          <BadgeCheck className="size-3.5" /> Identity verified
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
                <Input id="first" defaultValue={customer.firstName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last">Last name</Label>
                <Input id="last" defaultValue={customer.lastName} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email address</Label>
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="email" type="email" defaultValue={customer.email} className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Mobile number</Label>
                <div className="relative">
                  <Phone className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="phone" defaultValue={customer.phone} className="pl-9" />
                </div>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="address">Home address</Label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input id="address" defaultValue={customer.address} className="pl-9" />
                </div>
              </div>
            </div>
            <Separator className="my-6" />
            <div className="flex flex-wrap gap-3">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button type="button" variant="outline">
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
                  <Input id="current" type="password" placeholder="••••••••••" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new">New password</Label>
                  <Input id="new" type="password" placeholder="••••••••••" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm">Confirm new password</Label>
                  <Input id="confirm" type="password" placeholder="••••••••••" />
                </div>
              </div>
              <Button className="mt-5" onClick={() => toast.success("Password updated")}>
                Update password
              </Button>
            </section>

            <section className="surface-card p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold">
                <ShieldCheck className="size-4 text-accent" /> Two-factor authentication
              </h3>
              <div className="mt-4 flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                <div>
                  <p className="text-sm font-medium">SMS verification</p>
                  <p className="text-xs text-muted-foreground">Codes sent to {customer.phone}</p>
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
          <section className="surface-card max-w-3xl p-6">
            <h3 className="flex items-center gap-2 text-lg font-semibold">
              <Bell className="size-4 text-accent" /> How we contact you
            </h3>
            <ul className="mt-5 space-y-3">
              {(
                [
                  ["email", "Email updates", "Case progress, solicitor decisions and document requests"],
                  ["sms", "SMS alerts", "Urgent actions and verification codes"],
                  ["ai", "AI insight digests", "Weekly summaries of your financial position"],
                  ["marketing", "Service updates", "Occasional news about FG Debt Advisor AI features"],
                ] as const
              ).map(([key, title, desc]) => (
                <li key={key} className="flex items-center justify-between gap-4 rounded-xl border border-border p-4">
                  <div>
                    <p className="text-sm font-medium">{title}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={prefs[key]}
                    onCheckedChange={(v) => setPrefs((p) => ({ ...p, [key]: v }))}
                    aria-label={title}
                  />
                </li>
              ))}
            </ul>
          </section>
        </TabsContent>

        <TabsContent value="privacy">
          <div className="grid max-w-3xl gap-6">
            <section className="surface-card p-6">
              <h3 className="text-lg font-semibold">Your data rights</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Under UK GDPR you can request a copy of everything we hold about you at any time.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => toast.success("We'll email your data export within 30 days")}>
                  Request data export
                </Button>
                <Button variant="outline">View privacy notice</Button>
              </div>
            </section>

            <section className="surface-card border-destructive/30 p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-destructive">
                <Trash2 className="size-4" /> Close my account
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Closing your account ends all active cases. Regulatory rules require us to retain
                case records for six years, even after closure.
              </p>
              <Button variant="destructive" className="mt-5">
                Request account closure
              </Button>
            </section>
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
