import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Customer, CustomerContact, Project } from "@shared/schema";
import { CONTACT_CATEGORIES } from "@shared/schema";
import { contactDisplayName } from "@/lib/contact-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import {
  ChevronDown, ChevronRight, Plus, User, Phone, Mail, MapPin, Pencil, Trash2, FolderOpen,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_LABELS: Record<string, string> = {
  client: "Client",
  supplier: "Supplier",
  subcontractor: "Subcontractor",
  consultant: "Consultant",
  other: "Other",
};

const emptyContactForm = { firstName: "", lastName: "", email: "", phone: "", mobile: "", roleTitle: "", category: "client", notes: "", isPrimary: false };

function ContactRow({ contact, onEdit, onDelete }: { contact: CustomerContact; onEdit: (c: CustomerContact) => void; onDelete: (id: string) => void }) {
  return (
    <div className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-muted/50 group">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="font-medium text-sm truncate">{contactDisplayName(contact)}</span>
        {contact.isPrimary && <Badge variant="outline" className="text-xs px-1.5 py-0">Primary</Badge>}
        {contact.category && contact.category !== "client" && (
          <Badge variant="secondary" className="text-xs px-1.5 py-0">{CATEGORY_LABELS[contact.category] ?? contact.category}</Badge>
        )}
        {contact.roleTitle && <span className="text-xs text-muted-foreground hidden sm:inline">{contact.roleTitle}</span>}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {contact.email && <span className="hidden sm:inline">{contact.email}</span>}
        {contact.phone && <span className="hidden md:inline">{contact.phone}</span>}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onEdit(contact)}
            data-testid={`button-edit-contact-${contact.id}`}
          >
            <Pencil className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => onDelete(contact.id)}
            data-testid={`button-delete-contact-${contact.id}`}
          >
            <Trash2 className="h-3 w-3 text-destructive" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function CustomerRow({ customer }: { customer: Customer }) {
  const [expanded, setExpanded] = useState(false);
  const [showAddContact, setShowAddContact] = useState(false);
  const [showAddProject, setShowAddProject] = useState(false);
  const [editingContact, setEditingContact] = useState<CustomerContact | null>(null);
  const { toast } = useToast();

  const { data: contacts = [] } = useQuery<CustomerContact[]>({
    queryKey: ["/api/customers", customer.id, "contacts"],
    queryFn: () => fetch(`/api/customers/${customer.id}/contacts`).then((r) => r.json()),
    enabled: expanded,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/customers", customer.id, "projects"],
    queryFn: () => fetch(`/api/customers/${customer.id}/projects`).then((r) => r.json()),
    enabled: expanded,
  });

  const addContactMutation = useMutation({
    mutationFn: async (data: typeof emptyContactForm) => {
      const res = await apiRequest("POST", `/api/customers/${customer.id}/contacts`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setShowAddContact(false);
      setContactForm({ ...emptyContactForm });
      toast({ title: "Contact added" });
    },
  });

  const editContactMutation = useMutation({
    mutationFn: async (data: typeof emptyContactForm) => {
      if (!editingContact) return;
      const res = await apiRequest("PATCH", `/api/contacts/${editingContact.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setEditingContact(null);
      toast({ title: "Contact updated" });
    },
  });

  const deleteContactMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/contacts/${id}`, undefined);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "contacts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
    },
  });

  const [contactForm, setContactForm] = useState({ ...emptyContactForm });
  const [editContactForm, setEditContactForm] = useState({ ...emptyContactForm });

  function openEditContact(contact: CustomerContact) {
    setEditingContact(contact);
    setEditContactForm({
      firstName: contact.firstName || "",
      lastName: contact.lastName || "",
      email: contact.email || "",
      phone: contact.phone || "",
      mobile: contact.mobile || "",
      roleTitle: contact.roleTitle || "",
      category: contact.category || "client",
      notes: contact.notes || "",
      isPrimary: contact.isPrimary ?? false,
    });
  }
  const [projectForm, setProjectForm] = useState({ name: "", address: "", description: "", notes: "" });

  const addProjectMutation = useMutation({
    mutationFn: async (data: typeof projectForm) => {
      const res = await apiRequest("POST", "/api/projects", { ...data, customerId: customer.id });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Failed to create project");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers", customer.id, "projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      setShowAddProject(false);
      setProjectForm({ name: "", address: "", description: "", notes: "" });
      toast({ title: "Project created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setExpanded((v) => !v)}
        data-testid={`row-customer-${customer.id}`}
      >
        <TableCell className="w-8">
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </TableCell>
        <TableCell className="font-medium">{customer.name}</TableCell>
        <TableCell className="text-sm text-muted-foreground hidden sm:table-cell">{customer.email ?? "—"}</TableCell>
        <TableCell className="text-sm text-muted-foreground hidden md:table-cell">{customer.phone ?? "—"}</TableCell>
        <TableCell className="text-sm text-muted-foreground hidden lg:table-cell truncate max-w-[180px]">{customer.address ?? "—"}</TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={5} className="bg-muted/20 py-3 px-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contacts</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => { e.stopPropagation(); setShowAddContact(true); }}
                    data-testid={`button-add-contact-${customer.id}`}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Contact
                  </Button>
                </div>
                {contacts.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1">No contacts yet.</p>
                ) : (
                  <div className="space-y-0.5">
                    {contacts.map((c) => (
                      <ContactRow
                        key={c.id}
                        contact={c}
                        onEdit={openEditContact}
                        onDelete={(id) => deleteContactMutation.mutate(id)}
                      />
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Projects</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={(e) => { e.stopPropagation(); setShowAddProject(true); }}
                    data-testid={`button-add-project-${customer.id}`}
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Project
                  </Button>
                </div>
                {projects.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-1">No projects yet.</p>
                ) : (
                  <div className="space-y-1">
                    {projects.map((p) => (
                      <div key={p.id} className="flex items-center gap-3 py-1.5 px-2 rounded hover:bg-muted/50" data-testid={`row-project-${p.id}`}>
                        <FolderOpen className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" data-testid={`text-project-name-${p.id}`}>{p.name}</p>
                          {p.address && <p className="text-xs text-muted-foreground truncate">{p.address}</p>}
                          {p.description && <p className="text-xs text-muted-foreground truncate">{p.description}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TableCell>
        </TableRow>
      )}

      <Dialog open={showAddContact} onOpenChange={setShowAddContact}>
        <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Add Contact — {customer.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name *</Label>
                <Input value={contactForm.firstName} onChange={(e) => setContactForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="e.g. Jane" data-testid="input-contact-firstname" />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input value={contactForm.lastName} onChange={(e) => setContactForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="e.g. Smith" data-testid="input-contact-lastname" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Role Title</Label>
                <Input value={contactForm.roleTitle} onChange={(e) => setContactForm((f) => ({ ...f, roleTitle: e.target.value }))} placeholder="e.g. Owner, Site Manager" data-testid="input-contact-roletitle" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={contactForm.category} onValueChange={(v) => setContactForm((f) => ({ ...f, category: v }))}>
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
                <Input type="email" value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} data-testid="input-contact-email" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={contactForm.phone} onChange={(e) => setContactForm((f) => ({ ...f, phone: e.target.value }))} data-testid="input-contact-phone" />
              </div>
            </div>
            <div>
              <Label>Mobile</Label>
              <Input value={contactForm.mobile} onChange={(e) => setContactForm((f) => ({ ...f, mobile: e.target.value }))} data-testid="input-contact-mobile" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={contactForm.notes} onChange={(e) => setContactForm((f) => ({ ...f, notes: e.target.value }))} rows={2} data-testid="input-contact-notes" />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="add-contact-primary"
                checked={contactForm.isPrimary}
                onCheckedChange={(v) => setContactForm((f) => ({ ...f, isPrimary: v }))}
                data-testid="switch-contact-primary"
              />
              <Label htmlFor="add-contact-primary" className="cursor-pointer text-sm">Primary contact</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddContact(false)}>Cancel</Button>
            <Button
              onClick={() => addContactMutation.mutate(contactForm)}
              disabled={!contactForm.firstName || addContactMutation.isPending}
              data-testid="button-save-contact"
            >
              {addContactMutation.isPending ? "Adding…" : "Add Contact"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingContact} onOpenChange={(open) => { if (!open) setEditingContact(null); }}>
        <DialogContent className="max-w-md" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>First Name *</Label>
                <Input value={editContactForm.firstName} onChange={(e) => setEditContactForm((f) => ({ ...f, firstName: e.target.value }))} placeholder="e.g. Jane" data-testid="input-edit-contact-firstname" />
              </div>
              <div>
                <Label>Last Name</Label>
                <Input value={editContactForm.lastName} onChange={(e) => setEditContactForm((f) => ({ ...f, lastName: e.target.value }))} placeholder="e.g. Smith" data-testid="input-edit-contact-lastname" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Role Title</Label>
                <Input value={editContactForm.roleTitle} onChange={(e) => setEditContactForm((f) => ({ ...f, roleTitle: e.target.value }))} placeholder="e.g. Owner, Site Manager" data-testid="input-edit-contact-roletitle" />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={editContactForm.category} onValueChange={(v) => setEditContactForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger data-testid="select-edit-contact-category">
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
                <Input type="email" value={editContactForm.email} onChange={(e) => setEditContactForm((f) => ({ ...f, email: e.target.value }))} data-testid="input-edit-contact-email" />
              </div>
              <div>
                <Label>Phone</Label>
                <Input value={editContactForm.phone} onChange={(e) => setEditContactForm((f) => ({ ...f, phone: e.target.value }))} data-testid="input-edit-contact-phone" />
              </div>
            </div>
            <div>
              <Label>Mobile</Label>
              <Input value={editContactForm.mobile} onChange={(e) => setEditContactForm((f) => ({ ...f, mobile: e.target.value }))} data-testid="input-edit-contact-mobile" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={editContactForm.notes} onChange={(e) => setEditContactForm((f) => ({ ...f, notes: e.target.value }))} rows={2} data-testid="input-edit-contact-notes" />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="edit-contact-primary"
                checked={editContactForm.isPrimary}
                onCheckedChange={(v) => setEditContactForm((f) => ({ ...f, isPrimary: v }))}
                data-testid="switch-edit-contact-primary"
              />
              <Label htmlFor="edit-contact-primary" className="cursor-pointer text-sm">Primary contact</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingContact(null)}>Cancel</Button>
            <Button
              onClick={() => editContactMutation.mutate(editContactForm)}
              disabled={!editContactForm.firstName || editContactMutation.isPending}
              data-testid="button-save-edit-contact"
            >
              {editContactMutation.isPending ? "Saving…" : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAddProject} onOpenChange={setShowAddProject}>
        <DialogContent className="max-w-sm" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Add Project — {customer.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Project Name *</Label>
              <Input
                value={projectForm.name}
                onChange={(e) => setProjectForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g. 23 Main St — Renovation"
                data-testid="input-project-name"
              />
            </div>
            <div>
              <Label>Site Address</Label>
              <Input
                value={projectForm.address}
                onChange={(e) => setProjectForm((f) => ({ ...f, address: e.target.value }))}
                placeholder="Street address of the site"
                data-testid="input-project-address"
              />
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={projectForm.description}
                onChange={(e) => setProjectForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description"
                data-testid="input-project-description"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea
                value={projectForm.notes}
                onChange={(e) => setProjectForm((f) => ({ ...f, notes: e.target.value }))}
                rows={2}
                data-testid="input-project-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddProject(false)}>Cancel</Button>
            <Button
              onClick={() => addProjectMutation.mutate(projectForm)}
              disabled={!projectForm.name || addProjectMutation.isPending}
              data-testid="button-save-project"
            >
              {addProjectMutation.isPending ? "Creating…" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Customers() {
  const { toast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "", notes: "" });

  const { data: customers = [], isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof form) => {
      const res = await apiRequest("POST", "/api/customers", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      setShowCreate(false);
      setForm({ name: "", email: "", phone: "", address: "", notes: "" });
      toast({ title: "Customer created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-customers-heading">Customers</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage customers and contacts across all divisions.</p>
        </div>
        <Button onClick={() => setShowCreate(true)} data-testid="button-new-customer">
          <Plus className="h-4 w-4 mr-2" /> New Customer
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : customers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <User className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No customers yet. Add your first customer to get started.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8" />
                <TableHead>Name</TableHead>
                <TableHead className="hidden sm:table-cell">Email</TableHead>
                <TableHead className="hidden md:table-cell">Phone</TableHead>
                <TableHead className="hidden lg:table-cell">Address</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => (
                <CustomerRow key={c.id} customer={c} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Customer</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Company / Customer Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} data-testid="input-customer-name" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} data-testid="input-customer-email" />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} data-testid="input-customer-phone" />
            </div>
            <div>
              <Label>Address</Label>
              <Input value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} data-testid="input-customer-address" />
            </div>
            <div>
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} rows={2} data-testid="input-customer-notes" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate(form)}
              disabled={!form.name || createMutation.isPending}
              data-testid="button-save-customer"
            >
              Create Customer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
