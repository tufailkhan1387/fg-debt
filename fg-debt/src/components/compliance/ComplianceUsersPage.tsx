import { useState } from "react";
import { Loader2, ShieldCheck, ShieldOff, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SolicitorDataLoading } from "@/components/solicitor/SolicitorDataStates";
import { PrincipalGate } from "@/components/compliance/PrincipalGate";
import { ApiError } from "@/lib/api";
import type { ComplianceRole } from "@/lib/auth";
import {
  useCreateFirmUser,
  useFirmUsers,
  useUpdateFirmUser,
  type AccessLevel,
  type FirmUser,
} from "@/lib/compliance-access-api";

const ROLE_OPTIONS: Array<{ value: ComplianceRole | "none"; label: string }> = [
  { value: "principal", label: "Principal" },
  { value: "staff", label: "Staff" },
  { value: "viewer", label: "Viewer (read-only)" },
  { value: "none", label: "No access" },
];

const LEVEL_OPTIONS: Array<{ value: AccessLevel; label: string }> = [
  { value: "none", label: "None" },
  { value: "view", label: "View" },
  { value: "edit", label: "Edit" },
];

function errorMessage(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function ComplianceUsersPage() {
  return (
    <PrincipalGate>
      <UsersAndAccess />
    </PrincipalGate>
  );
}

function UsersAndAccess() {
  const { data, isLoading, isError } = useFirmUsers();
  const updateUser = useUpdateFirmUser();
  const [addOpen, setAddOpen] = useState(false);

  if (isLoading) return <SolicitorDataLoading label="Loading users…" />;
  if (isError || !data) {
    return <p className="py-12 text-center text-sm text-muted-foreground">Could not load users.</p>;
  }

  const save = (user: FirmUser, change: { complianceRole?: ComplianceRole | null; permissions?: Record<string, AccessLevel> }) => {
    updateUser.mutate(
      { id: user.id, ...change },
      {
        onSuccess: () => toast.success(`Access updated for ${user.name}.`),
        onError: (error) => toast.error("Could not update access", { description: errorMessage(error, "Please try again.") }),
      },
    );
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold tracking-tight text-foreground sm:text-3xl">Users & Access</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose who can use the compliance system and what each person can see or change. Every change is recorded
            in the access log.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <UserPlus className="size-4" /> Add user
        </Button>
      </div>

      <Card className="surface-card">
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs font-semibold">User</TableHead>
                <TableHead className="text-xs font-semibold">Two-factor</TableHead>
                <TableHead className="text-xs font-semibold">Role</TableHead>
                {data.modules.map((module) => (
                  <TableHead key={module.id} className="text-xs font-semibold">
                    {module.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.users.map((user) => {
                const locked = user.complianceRole === "principal" || !user.complianceRole;
                return (
                  <TableRow key={user.id} className="text-xs">
                    <TableCell>
                      <div className="font-semibold">{user.name}</div>
                      <div className="text-muted-foreground">{user.email}</div>
                    </TableCell>
                    <TableCell>
                      {user.mfaEnabled ? (
                        <Badge variant="secondary" className="gap-1">
                          <ShieldCheck className="size-3" /> On
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="gap-1 text-muted-foreground">
                          <ShieldOff className="size-3" /> Off
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="min-w-[10rem]">
                      <Select
                        value={user.complianceRole ?? "none"}
                        disabled={updateUser.isPending}
                        onValueChange={(value) =>
                          save(user, { complianceRole: value === "none" ? null : (value as ComplianceRole) })
                        }
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLE_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    {data.modules.map((module) => (
                      <TableCell key={module.id} className="min-w-[7rem]">
                        {locked ? (
                          <span className="text-muted-foreground">
                            {user.complianceRole === "principal" ? "Full" : "—"}
                          </span>
                        ) : (
                          <Select
                            value={user.permissions[module.id] ?? "none"}
                            disabled={updateUser.isPending}
                            onValueChange={(value) => save(user, { permissions: { [module.id]: value as AccessLevel } })}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LEVEL_OPTIONS.filter((o) => user.complianceRole !== "viewer" || o.value !== "edit").map(
                                (option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ),
                              )}
                            </SelectContent>
                          </Select>
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Principal: full access, manages users. Staff: access per area as set here. Viewer: read-only, never edit.
      </p>

      <AddUserDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function AddUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createUser = useCreateFirmUser();
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    title: "",
    complianceRole: "staff" as ComplianceRole,
    temporaryPassword: "",
  });

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    createUser.mutate(form, {
      onSuccess: ({ user }) => {
        toast.success(`${user.name} added.`, {
          description: "Set their access per area in the table, and share the temporary password securely.",
        });
        setForm({ firstName: "", lastName: "", email: "", title: "", complianceRole: "staff", temporaryPassword: "" });
        onOpenChange(false);
      },
      onError: (error) => toast.error("Could not add user", { description: errorMessage(error, "Please try again.") }),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            Staff and viewers start with no access to any area. Give them rights in the table after adding them.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="firstName">First name</Label>
              <Input id="firstName" value={form.firstName} onChange={set("firstName")} required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lastName">Last name</Label>
              <Input id="lastName" value={form.lastName} onChange={set("lastName")} required />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={set("email")} required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="title">Job title</Label>
            <Input id="title" value={form.title} onChange={set("title")} placeholder="e.g. Paralegal" />
          </div>
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select
              value={form.complianceRole}
              onValueChange={(value) => setForm((prev) => ({ ...prev, complianceRole: value as ComplianceRole }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.filter((o) => o.value !== "none").map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="temporaryPassword">Temporary password</Label>
            <Input
              id="temporaryPassword"
              type="password"
              autoComplete="new-password"
              value={form.temporaryPassword}
              onChange={set("temporaryPassword")}
              minLength={8}
              required
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createUser.isPending}>
              {createUser.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserPlus className="size-4" />}
              Add user
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
