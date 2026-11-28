import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, ListMinus, ListPlus, Plus, Search, Upload, Users } from "lucide-react";
import { Can } from "@/components/auth/Can";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Checkbox } from "@/components/ui/Checkbox";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import { Pagination } from "@/components/ui/Pagination";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { SkeletonText } from "@/components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { ContactBulkListModal } from "@/components/campaigns/ContactBulkListModal";
import { ContactFormModal } from "@/components/campaigns/ContactFormModal";
import { ContactImportModal } from "@/components/campaigns/ContactImportModal";
import { ContactListsCard } from "@/components/campaigns/ContactListsCard";
import { ContactRowActionsMenu } from "@/components/campaigns/ContactRowActionsMenu";
import { ContactStatCards } from "@/components/campaigns/ContactStatCards";
import { ContactStatusBadge } from "@/components/campaigns/ContactStatusBadge";
import { CONTACT_SOURCE_LABEL, CONTACT_STATUS_FILTER_OPTIONS } from "@/config/campaigns";
import { DEFAULT_PAGE_SIZE } from "@/config/pagination";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/context";
import { useMyAccess } from "@/hooks/useMyAccess";
import {
  CONTACTS_QUERY_KEY,
  deleteContact,
  exportContacts,
  getContactLists,
  getContacts,
  updateContact,
} from "@/lib/api/campaigns";
import { saveBlob } from "@/utils/download";
import type { Contact, ContactFilters, ContactStatus } from "@/types/campaign";

const ALL = "all";
const SEARCH_DEBOUNCE_MS = 400;

type PendingAction = { kind: "delete" | "unsubscribe"; contact: Contact } | null;

const fullName = (c: Contact) => [c.first_name, c.last_name].filter(Boolean).join(" ");

export function ContactsPanel() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(DEFAULT_PAGE_SIZE);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState(ALL);
  const [list, setList] = useState(ALL);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Contact | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [pending, setPending] = useState<PendingAction>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode] = useState<"add" | "remove" | null>(null);
  const { can } = useMyAccess();
  const canBulk = can(PERMISSIONS.campaigns.update);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filters: ContactFilters = {
    search: search || undefined,
    status: status === ALL ? undefined : (status as ContactStatus),
    list: list === ALL ? undefined : list,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...CONTACTS_QUERY_KEY, "list", { page, limit, ...filters }],
    queryFn: () => getContacts({ page, limit, ...filters }),
    placeholderData: keepPreviousData,
  });
  const { data: listsRes } = useQuery({ queryKey: [...CONTACTS_QUERY_KEY, "lists"], queryFn: getContactLists });

  const contacts = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const listOptions = [
    { value: ALL, label: "All lists" },
    ...(listsRes?.data ?? []).map((l) => ({ value: l.name, label: `${l.name} (${l.subscribed})` })),
  ];
  const hasFilters = Boolean(search || status !== ALL || list !== ALL);
  const pageIds = contacts.map((c) => c._id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const toggle = (id: string, on: boolean) => {
    const next = new Set(selected);
    if (on) next.add(id);
    else next.delete(id);
    setSelected(next);
  };
  const togglePage = (on: boolean) => {
    const next = new Set(selected);
    pageIds.forEach((id) => (on ? next.add(id) : next.delete(id)));
    setSelected(next);
  };
  const selectList = (name: string | null) => {
    setList(name ?? ALL);
    setPage(1);
  };

  const actionMutation = useMutation({
    mutationFn: (action: NonNullable<PendingAction>) =>
      action.kind === "delete" ? deleteContact(action.contact._id) : updateContact(action.contact._id, { status: "unsubscribed" }),
    onSuccess: (_res, action) => {
      void queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
      toast({ title: action.kind === "delete" ? "Contact deleted" : "Contact unsubscribed", tone: "success" });
      setPending(null);
    },
    onError: (err: Error) => toast({ title: "Couldn't update the contact", description: err.message, tone: "danger" }),
  });

  const exportMutation = useMutation({
    mutationFn: () => exportContacts(filters),
    onSuccess: ({ blob, filename }) => saveBlob(blob, filename),
    onError: (err: Error) => toast({ title: "Export failed", description: err.message, tone: "danger" }),
  });

  const openForm = (contact: Contact | null) => {
    setEditing(contact);
    setFormOpen(true);
  };

  return (
    <div className="space-y-4">
      <ContactStatCards />
      <ContactListsCard active={list === ALL ? null : list} onSelect={selectList} />

      <Card>
        <div className="flex flex-col gap-3 border-b border-border px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
              <Input
                placeholder="Search email or name…"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="pl-9"
              />
            </div>
            <SingleSelect
              options={CONTACT_STATUS_FILTER_OPTIONS}
              value={status}
              onChange={(v) => {
                setStatus(v);
                setPage(1);
              }}
              className="sm:w-44 sm:shrink-0"
            />
            <SingleSelect
              options={listOptions}
              value={list}
              onChange={(v) => {
                setList(v);
                setPage(1);
              }}
              className="sm:w-48 sm:shrink-0"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isFetching && !isLoading ? <span className="text-xs text-fg/40">Updating…</span> : null}
            <Can permission={PERMISSIONS.campaigns.export}>
              <Button variant="secondary" onClick={() => exportMutation.mutate()} disabled={exportMutation.isPending || !total}>
                <Download className="h-4 w-4" />
                Export
              </Button>
            </Can>
            <Can permission={PERMISSIONS.campaigns.create}>
              <Button variant="secondary" onClick={() => setImportOpen(true)}>
                <Upload className="h-4 w-4" />
                Import
              </Button>
              <Button variant="primary" onClick={() => openForm(null)}>
                <Plus className="h-4 w-4" />
                Add contact
              </Button>
            </Can>
          </div>
        </div>

        {selected.size ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border bg-bg-2 px-5 py-2 text-sm">
            <span className="font-medium text-fg">{selected.size} selected</span>
            <Button variant="secondary" size="sm" onClick={() => setBulkMode("add")}>
              <ListPlus className="h-4 w-4" />
              Add to list
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setBulkMode("remove")}>
              <ListMinus className="h-4 w-4" />
              Remove from list
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        ) : null}

        {isLoading ? (
          <div className="p-5">
            <SkeletonText lines={6} />
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title={hasFilters ? "No contacts match" : "No contacts yet"}
            description={
              hasFilters
                ? "Try a different search or filter."
                : "Website newsletter signups land here automatically. You can also import a spreadsheet."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-200">
              <TableHeader>
                <TableRow>
                  {canBulk ? (
                    <TableHead className="w-10">
                      <Checkbox checked={allOnPage} onChange={(e) => togglePage(e.target.checked)} aria-label="Select this page" />
                    </TableHead>
                  ) : null}
                  <TableHead>Contact</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Lists</TableHead>
                  <TableHead className="text-right">Added</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((contact) => (
                  <TableRow key={contact._id}>
                    {canBulk ? (
                      <TableCell>
                        <Checkbox
                          checked={selected.has(contact._id)}
                          onChange={(e) => toggle(contact._id, e.target.checked)}
                          aria-label={`Select ${contact.email}`}
                        />
                      </TableCell>
                    ) : null}
                    <TableCell>
                      <div className="truncate font-medium text-fg">{contact.email}</div>
                      <div className="truncate text-xs text-fg/50">{fullName(contact) || "—"}</div>
                    </TableCell>
                    <TableCell>
                      <ContactStatusBadge status={contact.status} />
                      {contact.status === "bounced" && contact.bounce_reason ? (
                        <div className="mt-1 max-w-56 truncate text-2xs text-fg/50" title={contact.bounce_reason}>
                          {contact.bounce_reason}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-fg/60">{CONTACT_SOURCE_LABEL[contact.source]}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {contact.lists.length
                          ? contact.lists.map((l) => (
                              <Badge key={l} variant="outline">
                                {l}
                              </Badge>
                            ))
                          : <span className="text-fg/40">—</span>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-fg/60">{new Date(contact.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <ContactRowActionsMenu
                        contact={contact}
                        onEdit={() => openForm(contact)}
                        onUnsubscribe={() => setPending({ kind: "unsubscribe", contact })}
                        onDelete={() => setPending({ kind: "delete", contact })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <Pagination
          currentPage={page}
          totalPages={data?.data?.totalPages ?? 1}
          totalItems={total}
          itemsPerPage={limit}
          onLimitChange={(l) => {
            setLimit(l);
            setPage(1);
          }}
          isLoading={isFetching}
          onPageChange={setPage}
        />
      </Card>

      <ContactFormModal open={formOpen} onOpenChange={setFormOpen} contact={editing} />
      <ContactImportModal open={importOpen} onOpenChange={setImportOpen} />
      <ContactBulkListModal
        mode={bulkMode}
        ids={[...selected]}
        onOpenChange={(o) => !o && setBulkMode(null)}
        onDone={() => {
          setBulkMode(null);
          setSelected(new Set());
        }}
      />
      <ConfirmModal
        open={!!pending}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.kind === "delete" ? "Delete this contact?" : "Unsubscribe this contact?"}
        description={
          pending?.kind === "delete"
            ? `${pending.contact.email} will be removed. If they're added again later, they'll count as a new subscriber.`
            : `${pending?.contact.email} won't receive campaigns again unless they sign up on the website themselves.`
        }
        confirmLabel={pending?.kind === "delete" ? "Delete" : "Unsubscribe"}
        tone={pending?.kind === "delete" ? "danger" : "warn"}
        confirming={actionMutation.isPending}
        onConfirm={() => pending && actionMutation.mutate(pending)}
      />
    </div>
  );
}
