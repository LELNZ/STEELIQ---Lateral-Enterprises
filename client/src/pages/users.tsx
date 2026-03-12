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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Plus, Pencil, KeyRound, UserCheck, UserX, ShieldAlert } from "lucide-react";

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

const ROLE_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  owner: "default",
  admin: "default",
  estimator: "secondary",
  finance: "secondary",
  production: "secondary",
  viewer: "outline",
};

function EmptyField({ label }: { label: string }) {
  return <span className="text-xs text-muted-foreground italic">{label}</span>;
}

function CreateUserDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    username: "",
    password: "",
    displayName: "",
    email: "",
    role: "estimator" as Role,
    divisionCode: "__none__",
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/auth/users", {
        ...form,
        divisionCode: form.divisionCode === "__none__" ? undefined : form.divisionCode,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error?.formErrors?.[0] ?? body.error ?? "Failed to create user");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/users"] });
      toast({ title: "User created" });
      onOpenChange(false);
      setForm({ username: "", password: "", displayName: "", email: "", role: "estimator", divisionCode: "__none__" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Create User</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Username *</Label>
              <Input value={form.username} onChange={(e) => set("username")(e.target.value)} placeholder="john.smith" data-testid="input-username-create" />
            </div>
            <div>
              <Label>Password *</Label>
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => set("role")(v)}>
                <SelectTrigger data-testid="select-role-create"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Division</Label>
              <Select value={form.divisionCode} onValueChange={(v) => set("divisionCode")(v)}>
                <SelectTrigger data-testid="select-division-create"><SelectValue placeholder="All divisions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All divisions</SelectItem>
                  {DIVISIONS.map((d) => <SelectItem key={d.code} value={d.code}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
  const [form, setForm] = useState({
    displayName: user.displayName ?? "",
    email: user.email ?? "",
    role: (user.role ?? "estimator") as Role,
    divisionCode: user.divisionCode ?? "__none__",
    isActive: user.isActive,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", `/api/auth/users/${user.id}`, {
        ...form,
        divisionCode: form.divisionCode === "__none__" ? null : form.divisionCode,
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
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Role</Label>
              <Select value={form.role} onValueChange={(v) => set("role")(v)}>
                <SelectTrigger data-testid="select-role-edit"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => <SelectItem key={r} value={r}>{ROLE_LABELS[r]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Division</Label>
              <Select value={form.divisionCode} onValueChange={(v) => set("divisionCode")(v)}>
                <SelectTrigger data-testid="select-division-edit"><SelectValue placeholder="All divisions" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">All divisions</SelectItem>
                  {DIVISIONS.map((d) => <SelectItem key={d.code} value={d.code}>{d.label}</SelectItem>)}
                </SelectContent>
              </Select>
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
      toast({ title: "Password updated" });
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
        <div className="space-y-3">
          <div>
            <Label>New Password (min 6 chars)</Label>
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
            {mutation.isPending ? "Saving…" : "Set Password"}
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

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" data-testid="heading-users">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage team access and permissions across all divisions</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)} data-testid="button-create-user">
          <Plus className="h-4 w-4 mr-1.5" /> Add User
        </Button>
      </div>

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Division</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
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
              <TableRow key={u.id} data-testid={`row-user-${u.id}`} className={u.isActive ? "" : "opacity-50"}>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm" data-testid={`text-display-name-${u.id}`}>{u.displayName || <EmptyField label="No display name" />}</p>
                    <p className="text-xs text-muted-foreground font-mono" data-testid={`text-username-${u.id}`}>{u.username}</p>
                  </div>
                </TableCell>
                <TableCell className="text-sm" data-testid={`text-email-${u.id}`}>
                  {u.email || <EmptyField label="—" />}
                </TableCell>
                <TableCell>
                  <Badge variant={ROLE_COLORS[u.role] ?? "secondary"} className="text-xs" data-testid={`badge-role-${u.id}`}>
                    {ROLE_LABELS[u.role] ?? u.role}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm" data-testid={`text-division-${u.id}`}>
                  {u.divisionCode || <EmptyField label="All" />}
                </TableCell>
                <TableCell>
                  {u.isActive ? (
                    <Badge variant="outline" className="text-xs text-green-600 border-green-300" data-testid={`badge-status-${u.id}`}>Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground" data-testid={`badge-status-${u.id}`}>Inactive</Badge>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground" data-testid={`text-created-${u.id}`}>
                  {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-NZ") : "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setEditUser(u)}
                      title="Edit user"
                      data-testid={`button-edit-${u.id}`}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => setResetUser(u)}
                      title="Reset password"
                      data-testid={`button-reset-password-${u.id}`}
                    >
                      <KeyRound className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0"
                      onClick={() => toggleActiveMutation.mutate({ id: u.id, isActive: !u.isActive })}
                      disabled={toggleActiveMutation.isPending}
                      title={u.isActive ? "Deactivate user" : "Activate user"}
                      data-testid={`button-toggle-active-${u.id}`}
                    >
                      {u.isActive ? <UserX className="h-3.5 w-3.5 text-muted-foreground" /> : <UserCheck className="h-3.5 w-3.5 text-green-600" />}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-lg bg-muted/40 border px-4 py-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground/70">Bootstrap admin account</p>
        <p>A default <span className="font-mono">admin</span> account is seeded automatically when no users exist. Change the password after first login.</p>
      </div>

      <CreateUserDialog open={showCreate} onOpenChange={setShowCreate} />
      {editUser && <EditUserDialog user={editUser} open={!!editUser} onOpenChange={(v) => !v && setEditUser(null)} />}
      {resetUser && <ResetPasswordDialog user={resetUser} open={!!resetUser} onOpenChange={(v) => !v && setResetUser(null)} />}
    </div>
  );
}
