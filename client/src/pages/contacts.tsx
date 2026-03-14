import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Customer, CustomerContact } from "@shared/schema";
import { CONTACT_CATEGORIES } from "@shared/schema";
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
import { Plus, Search, User, Pencil, Archive } from "lucide-react";
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
  name: "",
  email: "",
  phone: "",
  mobile: "",
  role: "",
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
          <Label>Full Name *</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Jane Smith"
            data-testid="input-contact-name"
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
      <div>
        <Label>Role / Title</Label>
        <Input
          value={form.role}
          onChange={(e) => setForm({ ...form, role: e.target.value })}
          placeholder="e.g. Site Manager, Owner"
          data-testid="input-contact-role"
        />
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
  const [createOpen, setCreateOpen] = useState(false);
  const [editContact, setEditContact] = useState<CustomerContact | null>(null);
  const [createForm, setCreateForm] = useState({ ...emptyForm });
  const [editForm, setEditForm] = useState({ ...emptyForm });

  const { data: contacts = [], isLoading } = useQuery<CustomerContact[]>({
    queryKey: ["/api/contacts"],
  });

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const customerMap = useMemo(() => {
    const m: Record<string, string> = {};
    customers.forEach((c) => { m[c.id] = c.name; });
    return m;
  }, [customers]);

  const filtered = useMemo(() => {
    let list = contacts;
    if (categoryFilter !== "all") list = list.filter((c) => c.category === categoryFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.phone || "").toLowerCase().includes(q) ||
        (customerMap[c.customerId] || "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [contacts, categoryFilter, search, customerMap]);

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
      name: contact.name,
      email: contact.email || "",
      phone: contact.phone || "",
      mobile: contact.mobile || "",
      role: contact.role || "",
      category: contact.category || "client",
      notes: contact.notes || "",
      isPrimary: contact.isPrimary ?? false,
      customerId: contact.customerId,
    });
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-contacts-heading">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">People linked to customers across the business.</p>
        </div>
        <Button onClick={() => { setCreateForm({ ...emptyForm }); setCreateOpen(true); }} data-testid="button-new-contact">
          <Plus className="h-4 w-4 mr-2" /> New Contact
        </Button>
      </div>

      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by name, email, phone, company…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-contacts-search"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-44" data-testid="select-contacts-category-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CONTACT_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>{CATEGORY_LABELS[c]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{contacts.length === 0 ? "No contacts yet. Add your first contact to get started." : "No contacts match your search."}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Customer / Company</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contact) => (
                <TableRow key={contact.id} data-testid={`row-contact-${contact.id}`}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm" data-testid={`text-contact-name-${contact.id}`}>{contact.name}</span>
                      {contact.isPrimary && <Badge variant="outline" className="text-xs px-1.5 py-0">Primary</Badge>}
                      {contact.role && <span className="text-xs text-muted-foreground hidden sm:inline">{contact.role}</span>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={CATEGORY_VARIANTS[contact.category || "other"] ?? "outline"} className="text-xs" data-testid={`badge-contact-category-${contact.id}`}>
                      {CATEGORY_LABELS[contact.category || "other"] ?? contact.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground" data-testid={`text-contact-customer-${contact.id}`}>
                    {customerMap[contact.customerId] ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">
                    {contact.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                    {contact.phone ?? contact.mobile ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
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
              ))}
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
              disabled={!createForm.name || !createForm.customerId || createMutation.isPending}
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
              disabled={!editForm.name || editMutation.isPending}
              data-testid="button-save-edit-contact"
            >
              {editMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
