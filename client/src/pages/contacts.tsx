import { useState, useDeferredValue } from "react";
import { PageShell, PageHeader, WorklistBody } from "@/components/ui/platform-layout";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Customer, CustomerContact } from "@shared/schema";
import { CONTACT_CATEGORIES } from "@shared/schema";
import { contactDisplayName } from "@/lib/contact-utils";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Plus, Search, User, Pencil, Archive, FlaskConical } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_LABELS: Record<string, string> = {
  client: "Client",
  supplier: "Supplier",
  subcontractor: "Subcontractor",
  consultant: "Consultant",
  other: "Other",
};

const CATEGORY_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  client: "default",
  supplier: "secondary",
  subcontractor: "secondary",
  consultant: "outline",
  other: "outline",
};

const emptyForm = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  mobile: "",
  roleTitle: "",
  category: "client" as string,
  notes: "",
  isPrimary: false,
  customerId: "",
};

function ContactForm({
  form,
  setForm,
  customers,
  lockCustomer,
}: {
  form: typeof emptyForm;
  setForm: (f: typeof emptyForm) => void;
  customers: Customer[];
  lockCustomer?: boolean;
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Customer / Company *</Label>
        <Select
          value={form.customerId}
          onValueChange={(v) => setForm({ ...form, customerId: v })}
          disabled={lockCustomer}
        >
          <SelectTrigger data-testid="select-contact-customer">
            <SelectValue placeholder="Select customer…" />
          </SelectTrigger>
          <SelectContent>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>First Name *</Label>
          <Input
            value={form.firstName}
            onChange={(e) => setForm({ ...form, firstName: e.target.value })}
            placeholder="e.g. Jane"
            data-testid="input-contact-firstname"
          />
        </div>
        <div>
          <Label>Last Name</Label>
          <Input
            value={form.lastName}
            onChange={(e) => setForm({ ...form, lastName: e.target.value })}
            placeholder="e.g. Smith"
            data-testid="input-contact-lastname"
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Role Title</Label>
          <Input
            value={form.roleTitle}
            onChange={(e) => setForm({ ...form, roleTitle: e.target.value })}
            placeholder="e.g. Site Manager, Owner"
            data-testid="input-contact-roletitle"
          />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger data-testid="select-contact-category">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONTACT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Email</Label>
          <Input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            data-testid="input-contact-email"
          />
        </div>
        <div>
          <Label>Phone</Label>
          <Input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            data-testid="input-contact-phone"
          />
        </div>
      </div>
      <div>
        <Label>Mobile</Label>
        <Input
          value={form.mobile}
          onChange={(e) => setForm({ ...form, mobile: e.target.value })}
          data-testid="input-contact-mobile"
        />
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
          data-testid="input-contact-notes"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="isPrimary"
          checked={form.isPrimary}
          onCheckedChange={(v) => setForm({ ...form, isPrimary: v })}
          data-testid="switch-contact-primary"
        />
        <Label htmlFor="isPrimary" className="cursor-pointer">Primary contact for this customer</Label>
      </div>
    </div>
  );
}

export default function Contacts() {
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const deferredSearch = useDeferredValue(search);
  const deferredCategory = useDeferredValue(categoryFilter);
  const [createOpen, setCreateOpen] = useState(false);
  const [editContact, setEditContact] = useState<CustomerContact | null>(null);
  const [createForm, setCreateForm] = useState({ ...emptyForm });
  const [editForm, setEditForm] = useState({ ...emptyForm });
  const { user } = useAuth();
  const isOwnerOrAdmin = user?.role === "owner" || user?.role === "admin";

  const demoFlagMutation = useMutation({
    mutationFn: async ({ id, isDemoRecord }: { id: string; isDemoRecord: boolean }) => {
      const res = await apiRequest("PATCH", `/api/customer-contacts/${id}/demo-flag`, { isDemoRecord });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update flag");
      }
      return res.json();
    },
    onSuccess: (_data, { isDemoRecord }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({ title: "Demo flag updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const searchParams = new URLSearchParams();
  if (deferredSearch.trim()) searchParams.set("q", deferredSearch.trim());
  if (deferredCategory !== "all") searchParams.set("category", deferredCategory);
  const queryString = searchParams.toString();

  const { data: contacts = [], isLoading } = useQuery<CustomerContact[]>({
    queryKey: ["/api/contacts", deferredSearch.trim(), deferredCategory],
    queryFn: () => fetch(`/api/contacts${queryString ? `?${queryString}` : ""}`).then((r) => r.json()),
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const customerMap: Record<string, string> = {};
  customers.forEach((c) => { customerMap[c.id] = c.name; });

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const { customerId, ...rest } = data;
      const res = await apiRequest("POST", `/api/customers/${customerId}/contacts`, rest);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create contact");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setCreateOpen(false);
      setCreateForm({ ...emptyForm });
      toast({ title: "Contact created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      if (!editContact) return;
      const { customerId: _cid, ...rest } = data;
      const res = await apiRequest("PATCH", `/api/contacts/${editContact.id}`, rest);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to update contact");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setEditContact(null);
      toast({ title: "Contact updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const archiveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/contacts/${id}/archive`, {});
      if (!res.ok) throw new Error("Failed to archive");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Contact archived" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  function openEdit(contact: CustomerContact) {
    setEditContact(contact);
    setEditForm({
      firstName: contact.firstName || "",
      lastName: contact.lastName || "",
      email: contact.email || "",
      phone: contact.phone || "",
      mobile: contact.mobile || "",
      roleTitle: contact.roleTitle || "",
      category: contact.category || "client",
      notes: contact.notes || "",
      isPrimary: contact.isPrimary ?? false,
      customerId: contact.customerId,
    });
  }

  return (
    <PageShell>
      <PageHeader
        icon={<User className="w-4 h-4 text-primary-foreground" />}
        title="Contacts"
        subtitle="People linked to customers across the business."
        titleTestId="text-contacts-heading"
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                className="pl-8 h-8 text-sm w-52"
                placeholder="Search name, email, phone…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-contacts-search"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-36 h-8 text-sm" data-testid="select-contacts-category-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CONTACT_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={() => { setCreateForm({ ...emptyForm }); setCreateOpen(true); }} data-testid="button-new-contact">
              <Plus className="h-3.5 w-3.5 mr-1.5" /> New Contact
            </Button>
          </div>
        }
      />
      <WorklistBody>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : contacts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{!deferredSearch.trim() && deferredCategory === "all" ? "No contacts yet. Add your first contact to get started." : "No contacts match your search."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Category</TableHead>
                <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Customer / Company</TableHead>
                <TableHead className="hidden sm:table-cell text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</TableHead>
                <TableHead className="hidden md:table-cell text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact) => {
                const initials = [contact.firstName, contact.lastName]
                  .filter(Boolean)
                  .map((n) => n![0].toUpperCase())
                  .join("") || "?";
                return (
                <TableRow key={contact.id} className="hover:bg-muted/30" data-testid={`row-contact-${contact.id}`}>
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-semibold shrink-0 select-none">
                        {initials}
                      </div>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm" data-testid={`text-contact-name-${contact.id}`}>{contactDisplayName(contact)}</span>
                          {contact.isPrimary && <Badge variant="outline" className="text-xs px-1.5 py-0">Primary</Badge>}
                          {(contact as any).isDemoRecord && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-400 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 shrink-0">
                              <FlaskConical className="h-2.5 w-2.5 mr-0.5" />Demo
                            </Badge>
                          )}
                        </div>
                        {contact.roleTitle && <span className="text-xs text-muted-foreground">{contact.roleTitle}</span>}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <Badge variant={CATEGORY_VARIANTS[contact.category || "other"] ?? "outline"} className="text-xs" data-testid={`badge-contact-category-${contact.id}`}>
                      {CATEGORY_LABELS[contact.category || "other"] ?? contact.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm py-2.5" data-testid={`text-contact-customer-${contact.id}`}>
                    <span className="font-medium">{customerMap[contact.customerId] ?? "—"}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden sm:table-cell py-2.5">
                    {contact.email ?? <span className="text-xs opacity-50">—</span>}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden md:table-cell py-2.5">
                    {contact.phone ?? contact.mobile ?? <span className="text-xs opacity-50">—</span>}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex items-center gap-1">
                      {isOwnerOrAdmin && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className={`h-7 w-7 p-0 ${(contact as any).isDemoRecord ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground"}`}
                          title={(contact as any).isDemoRecord ? "Remove demo flag" : "Flag as demo"}
                          onClick={() => demoFlagMutation.mutate({ id: contact.id, isDemoRecord: !(contact as any).isDemoRecord })}
                          disabled={demoFlagMutation.isPending}
                          data-testid={`button-demo-flag-contact-${contact.id}`}
                        >
                          <FlaskConical className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        onClick={() => openEdit(contact)}
                        data-testid={`button-edit-contact-${contact.id}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                        onClick={() => archiveMutation.mutate(contact.id)}
                        disabled={archiveMutation.isPending}
                        data-testid={`button-archive-contact-${contact.id}`}
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Contact</DialogTitle>
          </DialogHeader>
          <ContactForm form={createForm} setForm={setCreateForm} customers={customers} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(createForm)}
              disabled={!createForm.firstName || !createForm.customerId || createMutation.isPending}
              data-testid="button-save-new-contact"
            >
              {createMutation.isPending ? "Creating…" : "Create Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editContact} onOpenChange={(open) => { if (!open) setEditContact(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          {editContact && (
            <ContactForm form={editForm} setForm={setEditForm} customers={customers} lockCustomer />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditContact(null)}>Cancel</Button>
            <Button
              onClick={() => editMutation.mutate(editForm)}
              disabled={!editForm.firstName || editMutation.isPending}
              data-testid="button-save-edit-contact"
            >
              {editMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </WorklistBody>
    </PageShell>
  );
}
