import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { type User } from "@shared/schema";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import {
  Plus, Pencil, KeyRound, UserCheck, UserX, ShieldAlert, Users as UsersIcon,
  AlertTriangle, Copy, CheckCircle2, Info,
} from "lucide-react";
type SafeUser = Omit<User, "password">;

const ROLES = ["owner", "admin", "estimator", "finance", "production", "viewer"] as const;
type Role = typeof ROLES[number];

const DIVISIONS = [
  { code: "LJ", label: "LJ – Lateral Joinery" },
  { code: "LE", label: "LE – Lateral Engineering" },
  { code: "LL", label: "LL – Lateral Laser" },
];

const ROLE_LABELS: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  estimator: "Estimator",
  finance: "Finance",
  production: "Production",
  viewer: "Viewer",
};

const ROLE_DESCRIPTIONS: Record<string, string> = {
  owner: "Full system oversight across all divisions. Typically the company director or principal.",
  admin: "Manages users, system settings, and has broad operational access across all divisions.",
  estimator: "Can create, edit, and manage quotes and commercial estimating work.",
  finance: "Access to invoice and commercial finance data. Does not manage users or settings.",
  production: "Operational access for jobs and production modules (current and future).",
  viewer: "Read-only access to relevant data. Cannot create or edit records.",
};

const ROLE_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  owner: "default",
  admin: "default",
  estimator: "secondary",
  finance: "secondary",
  production: "secondary",
  viewer: "outline",
};

function DivisionPicker({ selected, onChange, testIdSuffix }: { selected: string[]; onChange: (codes: string[]) => void; testIdSuffix: string }) {
  const toggle = (code: string) => {
    if (selected.includes(code)) {
      onChange(selected.filter(c => c !== code));
    } else {
      onChange([...selected, code]);
    }
  };
  return (
    <div className="space-y-1.5">
      {DIVISIONS.map((d) => (
        <label key={d.code} className="flex items-center gap-2 cursor-pointer">
          <Checkbox
            checked={selected.includes(d.code)}
            onCheckedChange={() => toggle(d.code)}
            data-testid={`checkbox-division-${d.code}-${testIdSuffix}`}
          />
          <span className="text-sm">{d.label}</span>
        </label>
      ))}
      <p className="text-xs text-muted-foreground mt-1">
        {selected.length === 0 ? "No selection = all divisions" : `${selected.length} selected`}
      </p>
    </div>
  );
}

function RolePicker({ value, onChange, testIdSuffix }: { value: Role; onChange: (v: string) => void; testIdSuffix: string }) {
  return (
    <div className="space-y-1.5">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger data-testid={`select-role-${testIdSuffix}`}><SelectValue /></SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
        </SelectContent>
      </Select>
      {value && (
        <p className="text-xs text-muted-foreground leading-relaxed">{ROLE_DESCRIPTIONS[value]}</p>
      )}
    </div>
  );
}

interface OnboardingInfo {
  username: string;
  displayName?: string;
  role: string;
  divisionCode?: string;
}

function OnboardingDialog({ info, open, onOpenChange }: { info: OnboardingInfo; open: boolean; onOpenChange: (v: boolean) => void }) {
  const [copied, setCopied] = useState(false);
  const loginUrl = typeof window !== "undefined" ? window.location.origin + "/login" : "/login";

  const copyText = `SteelIQ Login Details\nURL: ${loginUrl}\nUsername: ${info.username}\nPassword: [the temporary password you set]\n\nIMPORTANT: You will be prompted to set a new password when you first log in.`;

  function handleCopy() {
    navigator.clipboard.writeText(copyText).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-600" />
            User Created — Onboarding Details
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 text-sm">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              SteelIQ does not send automated invite emails yet. Share these details with the staff member directly.
            </AlertDescription>
          </Alert>

          <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
            <div className="grid grid-cols-[120px_1fr] gap-1 text-sm">
              <span className="text-muted-foreground">Login URL</span>
              <span className="font-mono text-xs break-all">{loginUrl}</span>
              <span className="text-muted-foreground">Username</span>
              <span className="font-mono font-medium" data-testid="text-onboarding-username">{info.username}</span>
              <span className="text-muted-foreground">Role</span>
              <span>{ROLE_LABELS[info.role] ?? info.role}</span>
              {info.divisionCode && (
                <>
                  <span className="text-muted-foreground">Division</span>
                  <span className="font-mono">{info.divisionCode}</span>
                </>
              )}
              <span className="text-muted-foreground">Password</span>
              <span className="text-amber-700 font-medium">Temporary — set by admin</span>
            </div>
          </div>

          <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800 p-3 space-y-1 text-xs">
            <p className="font-semibold text-amber-800 dark:text-amber-300">What the staff member needs to know:</p>
            <ol className="list-decimal ml-4 space-y-0.5 text-amber-700 dark:text-amber-400">
              <li>Navigate to the login URL above</li>
              <li>Enter their username and the temporary password you told them</li>
              <li>They will be prompted to set a new personal password before accessing the app</li>
            </ol>
          </div>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={handleCopy} data-testid="button-copy-onboarding">
            {copied ? <CheckCircle2 className="h-3.5 w-3.5 mr-1 text-green-600" /> : <Copy className="h-3.5 w-3.5 mr-1" />}
            {copied ? "Copied!" : "Copy Details"}
          </Button>
          <Button onClick={() => onOpenChange(false)} data-testid="button-close-onboarding">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateUserDialog({ open, onOpenChange, onCreated }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (info: OnboardingInfo) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    username: "",
    password: "",
    displayName: "",
    email: "",
    role: "estimator" as Role,
    divisionCodes: [] as string[],
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/users", {
        ...form,
        divisionCodes: form.divisionCodes.length > 0 ? form.divisionCodes : undefined,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      onOpenChange(false);
      onCreated({
        username: form.username,
        displayName: form.displayName || undefined,
        role: form.role,
        divisionCode: form.divisionCodes.length > 0 ? form.divisionCodes.join(", ") : undefined,
      });
      setForm({ username: "", password: "", displayName: "", email: "", role: "estimator", divisionCodes: [] });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const set = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="text-xs">
              A temporary password is set by you. The staff member will be required to set their own password on first login.
            </AlertDescription>
          </Alert>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Username *</Label>
              <Input value={form.username} onChange={(e) => set("username")(e.target.value)} placeholder="john.smith" data-testid="input-username-create" />
            </div>
            <div>
              <Label>Temporary Password *</Label>
              <Input type="password" value={form.password} onChange={(e) => set("password")(e.target.value)} placeholder="Min 6 chars" data-testid="input-password-create" />
            </div>
          </div>
          <div>
            <Label>Display Name</Label>
            <Input value={form.displayName} onChange={(e) => set("displayName")(e.target.value)} placeholder="John Smith" data-testid="input-display-name-create" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} placeholder="john@lateralenterprises.co.nz" data-testid="input-email-create" />
          </div>
          <div className="grid grid-cols-2 gap-3 items-start">
            <div>
              <Label className="mb-1.5 block">Role</Label>
              <RolePicker value={form.role} onChange={(v) => set("role")(v)} testIdSuffix="create" />
            </div>
            <div>
              <Label className="mb-1.5 block">Divisions</Label>
              <DivisionPicker
                selected={form.divisionCodes}
                onChange={(codes) => setForm((f) => ({ ...f, divisionCodes: codes }))}
                testIdSuffix="create"
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.username || !form.password}
            data-testid="button-save-user"
          >
            {mutation.isPending ? "Creating…" : "Create User"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({ user, open, onOpenChange }: { user: SafeUser; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const initDivisionCodes = (user as any).divisionCodes ?? (user.divisionCode ? [user.divisionCode] : []);
  const [form, setForm] = useState({
    displayName: user.displayName ?? "",
    email: user.email ?? "",
    role: (user.role ?? "estimator") as Role,
    divisionCodes: initDivisionCodes as string[],
    isActive: user.isActive,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/auth/users/${user.id}`, {
        ...form,
        divisionCodes: form.divisionCodes.length > 0 ? form.divisionCodes : null,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      toast({ title: "User updated" });
      onOpenChange(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const set = (k: keyof typeof form) => (v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit User — <span className="font-mono text-sm">{user.username}</span></DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Display Name</Label>
            <Input value={form.displayName} onChange={(e) => set("displayName")(e.target.value)} data-testid="input-display-name-edit" />
          </div>
          <div>
            <Label>Email</Label>
            <Input type="email" value={form.email} onChange={(e) => set("email")(e.target.value)} data-testid="input-email-edit" />
          </div>
          <div className="grid grid-cols-2 gap-3 items-start">
            <div>
              <Label className="mb-1.5 block">Role</Label>
              <RolePicker value={form.role} onChange={(v) => set("role")(v)} testIdSuffix="edit" />
            </div>
            <div>
              <Label className="mb-1.5 block">Divisions</Label>
              <DivisionPicker
                selected={form.divisionCodes}
                onChange={(codes) => setForm((f) => ({ ...f, divisionCodes: codes }))}
                testIdSuffix="edit"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Switch
              id="active-toggle"
              checked={form.isActive}
              onCheckedChange={(v) => set("isActive")(v)}
              data-testid="switch-active-edit"
            />
            <Label htmlFor="active-toggle">Account active</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending} data-testid="button-save-edit-user">
            {mutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({ user, open, onOpenChange }: { user: SafeUser; open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/auth/users/${user.id}/reset-password`, { password });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to reset password");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      toast({ title: "Password reset", description: "User will be prompted to change it on next login." });
      onOpenChange(false);
      setPassword("");
      setConfirm("");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const mismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = password.length >= 6 && password === confirm && !mutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Reset Password — <span className="font-mono text-sm">{user.username}</span></DialogTitle>
        </DialogHeader>
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            This sets a temporary password. The user will be required to change it on next login.
          </AlertDescription>
        </Alert>
        <div className="space-y-3">
          <div>
            <Label>New Temporary Password (min 6 chars)</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="input-new-password" />
          </div>
          <div>
            <Label>Confirm Password</Label>
            <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} data-testid="input-confirm-password" className={mismatch ? "border-destructive" : ""} />
            {mismatch && <p className="text-xs text-destructive mt-1">Passwords do not match</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => mutation.mutate()} disabled={!canSubmit} data-testid="button-save-password">
            {mutation.isPending ? "Saving…" : "Set Temporary Password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function Users() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<SafeUser | null>(null);
  const [resetUser, setResetUser] = useState<SafeUser | null>(null);
  const [onboardingInfo, setOnboardingInfo] = useState<OnboardingInfo | null>(null);
  const [showRoleGuide, setShowRoleGuide] = useState(false);

  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "owner";

  const { data: users = [], isLoading } = useQuery<SafeUser[]>({
    queryKey: ["/api/auth/users"],
    queryFn: () => fetch("/api/auth/users").then((r) => r.json()),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await apiRequest("PATCH", `/api/auth/users/${id}`, { isActive });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      toast({ title: vars.isActive ? "User activated" : "User deactivated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });


  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-2">
          <ShieldAlert className="h-10 w-10 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">You do not have permission to manage users.</p>
        </div>
      </div>
    );
  }

  const hasBootstrapAdmin = users.some(u => u.username === "admin" && u.mustChangePassword === false);

  return (
    <div className="flex flex-col h-full bg-background">
      <header className="border-b px-4 sm:px-6 py-3 flex items-center justify-between gap-3 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-primary shrink-0">
            <UsersIcon className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-semibold tracking-tight" data-testid="heading-users">User Management</h1>
            <p className="text-[11px] text-muted-foreground leading-tight">Team access and permissions across all divisions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowRoleGuide(!showRoleGuide)} data-testid="button-role-guide">
            <Info className="h-4 w-4 mr-1" /> Role Guide
          </Button>
          <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-user">
            <Plus className="h-4 w-4 mr-1.5" /> Add User
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 sm:p-6">
      <div className="max-w-5xl mx-auto space-y-6">

      {showRoleGuide && (
        <div className="rounded-lg border bg-muted/20 p-4 space-y-3">
          <h3 className="text-sm font-semibold">Role Descriptions</h3>
          <div className="grid gap-2">
            {ROLES.map((r) => (
              <div key={r} className="flex items-start gap-3 text-sm">
                <Badge variant={ROLE_COLORS[r]} className="text-xs min-w-[90px] justify-center shrink-0">{ROLE_LABELS[r]}</Badge>
                <span className="text-muted-foreground">{ROLE_DESCRIPTIONS[r]}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {hasBootstrapAdmin && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            <strong>Action required:</strong> The default <span className="font-mono">admin</span> bootstrap account still has its original password. Log in as that user and change the password now to remove this warning.
          </AlertDescription>
        </Alert>
      )}

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">User</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Role</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Division</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Created</TableHead>
              <TableHead className="w-[130px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Loading…</TableCell>
              </TableRow>
            )}
            {!isLoading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No users found.</TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.id} data-testid={`row-user-${u.id}`} className={u.isActive ? "hover:bg-muted/30" : "opacity-50 hover:bg-muted/30"}>
                <TableCell className="py-3">
                  <div>
                    <p className="font-medium text-sm" data-testid={`text-display-name-${u.id}`}>
                      {u.displayName || <span className="text-xs text-muted-foreground italic">No display name</span>}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono" data-testid={`text-username-${u.id}`}>{u.username}</p>
                    {u.mustChangePassword && (
                      <span className="text-[10px] text-amber-600 font-medium">Temp password — must change</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm py-3" data-testid={`text-email-${u.id}`}>
                  {u.email || <span className="text-xs text-muted-foreground italic">—</span>}
                </TableCell>
                <TableCell className="py-3">
                  <Badge variant={ROLE_COLORS[u.role] ?? "secondary"} className="text-xs" data-testid={`badge-role-${u.id}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm font-mono py-3" data-testid={`text-division-${u.id}`}>
                  {((u as any).divisionCodes?.length > 0 ? (u as any).divisionCodes.join(", ") : u.divisionCode) || <span className="text-xs text-muted-foreground">All</span>}
                </TableCell>
                <TableCell className="py-3">
                  {u.isActive ? (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-300" data-testid={`badge-status-${u.id}`}>Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground" data-testid={`badge-status-${u.id}`}>Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground py-3" data-testid={`text-created-${u.id}`}>
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-NZ") : "—"}
                </TableCell>
                <TableCell className="py-3">
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost" size="sm" className="h-7 w-7 p-0"
                      onClick={() => setEditUser(u)} title="Edit user"
                      data-testid={`button-edit-${u.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-7 w-7 p-0"
                      onClick={() => setResetUser(u)} title="Reset password"
                      data-testid={`button-reset-password-${u.id}`}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost" size="sm" className="h-7 w-7 p-0"
                      onClick={() => toggleActiveMutation.mutate({ id: u.id, isActive: !u.isActive })}
                      disabled={toggleActiveMutation.isPending}
                      title={u.isActive ? "Deactivate" : "Activate"}
                      data-testid={`button-toggle-active-${u.id}`}
                    >
                      {u.isActive
                        ? <UserX className="h-3.5 w-3.5 text-muted-foreground" />
                        : <UserCheck className="h-3.5 w-3.5 text-green-600" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Separator />

      <div className="rounded-lg bg-muted/30 border px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground/70">Bootstrap admin</p>
        <p>
          A default <span className="font-mono">admin</span> account is created automatically when the system has no users.
          This is a seed credential only — change the password and set up real named accounts before going live.
          Once the password is changed, this notice will clear.
        </p>
      </div>

      </div>
      </div>


      <CreateUserDialog open={showCreate} onOpenChange={setShowCreate} onCreated={(info) => setOnboardingInfo(info)} />
      {editUser && <EditUserDialog user={editUser} open={!!editUser} onOpenChange={(v) => !v && setEditUser(null)} />}
      {resetUser && <ResetPasswordDialog user={resetUser} open={!!resetUser} onOpenChange={(v) => !v && setResetUser(null)} />}
      {onboardingInfo && (
        <OnboardingDialog info={onboardingInfo} open={!!onboardingInfo} onOpenChange={(v) => !v && setOnboardingInfo(null)} />
      )}
    </div>
  );
}
