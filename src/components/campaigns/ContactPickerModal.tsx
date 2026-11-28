import { useEffect, useState } from "react";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Input } from "@/components/ui/Input";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { Pagination } from "@/components/ui/Pagination";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { SkeletonText } from "@/components/ui/Skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/Table";
import { CONTACT_SOURCE_LABEL, MAX_SELECTED_CONTACTS } from "@/config/campaigns";
import { useToast } from "@/context";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { CONTACTS_QUERY_KEY, getContactLists, getContacts, selectContactIds } from "@/lib/api/campaigns";
import { pluralize } from "@/utils/format";
import { SEARCH_DEBOUNCE_MS } from "@/config/pagination";
import type { ContactFilters, ContactSource } from "@/types/campaign";

interface ContactPickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string[];
  onChange: (ids: string[]) => void;
}

const ALL = "all";
const PAGE_SIZE = 25;
const SOURCE_OPTIONS = [
  { value: ALL, label: "All sources" },
  ...Object.entries(CONTACT_SOURCE_LABEL).map(([value, label]) => ({ value, label })),
];

export function ContactPickerModal({ open, onOpenChange, value, onChange }: ContactPickerModalProps) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set(value));
  const [page, setPage] = useState(1);
  const [input, setInput] = useState("");
  const search = useDebouncedValue(input.trim(), SEARCH_DEBOUNCE_MS);
  const [list, setList] = useState(ALL);
  const [source, setSource] = useState(ALL);

  useEffect(() => {
    if (open) setSelected(new Set(value));
  }, [open, value]);


  const filters: ContactFilters = {
    search: search || undefined,
    list: list === ALL ? undefined : list,
    source: source === ALL ? undefined : (source as ContactSource),
  };
  const { data, isLoading, isFetching } = useQuery({
    queryKey: [...CONTACTS_QUERY_KEY, "picker", { page, ...filters }],
    queryFn: () => getContacts({ page, limit: PAGE_SIZE, status: "subscribed", ...filters }),
    placeholderData: keepPreviousData,
    enabled: open,
  });
  const { data: listsRes } = useQuery({ queryKey: [...CONTACTS_QUERY_KEY, "lists"], queryFn: getContactLists, enabled: open });

  const contacts = data?.data?.items ?? [];
  const total = data?.data?.total ?? 0;
  const pageIds = contacts.map((c) => c._id);
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
  const atCap = selected.size >= MAX_SELECTED_CONTACTS;
  const listOptions = [{ value: ALL, label: "All lists" }, ...(listsRes?.data ?? []).map((l) => ({ value: l.name, label: l.name }))];

  // Adds ids until the cap; returns how many didn't fit.
  function addIds(ids: string[]) {
    const next = new Set(selected);
    let dropped = 0;
    for (const id of ids) {
      if (next.has(id)) continue;
      if (next.size >= MAX_SELECTED_CONTACTS) dropped += 1;
      else next.add(id);
    }
    setSelected(next);
    return dropped;
  }

  function toggle(id: string, on: boolean) {
    if (!on) {
      const next = new Set(selected);
      next.delete(id);
      setSelected(next);
    } else addIds([id]);
  }

  function togglePage(on: boolean) {
    if (on) addIds(pageIds);
    else setSelected(new Set([...selected].filter((id) => !pageIds.includes(id))));
  }

  const selectAllMutation = useMutation({
    mutationFn: () => selectContactIds(filters),
    onSuccess: (res) => {
      const dropped = addIds(res.data.ids);
      if (res.data.capped || dropped) {
        toast({ title: `Selection capped at ${MAX_SELECTED_CONTACTS} contacts`, description: "Narrow the filters or send in batches.", tone: "warning" });
      }
    },
    onError: (err: Error) => toast({ title: "Couldn't select contacts", description: err.message, tone: "danger" }),
  });

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-4xl">
        <ModalHeader>
          <ModalTitle>Choose contacts</ModalTitle>
          <ModalDescription>Only subscribed contacts are listed. Filter, then tick people or select everyone who matches.</ModalDescription>
        </ModalHeader>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg/40" />
            <Input className="pl-9" placeholder="Search email or name…" value={input} onChange={(e) => {
                setInput(e.target.value);
                setPage(1);
              }} />
          </div>
          <SingleSelect options={listOptions} value={list} onChange={(v) => { setList(v); setPage(1); }} className="sm:w-44 sm:shrink-0" />
          <SingleSelect options={SOURCE_OPTIONS} value={source} onChange={(v) => { setSource(v); setPage(1); }} className="sm:w-44 sm:shrink-0" />
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm">
          <span className="text-fg/70">
            <span className="font-medium text-fg">{selected.size}</span> selected
            {atCap ? <Badge variant="warn" className="ml-2">Limit {MAX_SELECTED_CONTACTS}</Badge> : null}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" size="sm" disabled={!total || selectAllMutation.isPending} onClick={() => selectAllMutation.mutate()}>
              Select all {total ? pluralize(total, "match") : ""}
            </Button>
            <Button type="button" variant="ghost" size="sm" disabled={!selected.size} onClick={() => setSelected(new Set())}>
              Clear
            </Button>
          </div>
        </div>

        <div className="mt-2 max-h-[50vh] overflow-y-auto rounded-xl border border-border">
          {isLoading ? (
            <div className="p-4">
              <SkeletonText lines={6} />
            </div>
          ) : contacts.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox checked={allOnPage} onChange={(e) => togglePage(e.target.checked)} aria-label="Select this page" />
                  </TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Lists</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow key={c._id} className="cursor-pointer" onClick={() => toggle(c._id, !selected.has(c._id))}>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={selected.has(c._id)} onChange={(e) => toggle(c._id, e.target.checked)} aria-label={`Select ${c.email}`} />
                    </TableCell>
                    <TableCell>
                      <div className="truncate font-medium text-fg">{c.email}</div>
                      <div className="truncate text-xs text-fg/50">{[c.first_name, c.last_name].filter(Boolean).join(" ") || "—"}</div>
                    </TableCell>
                    <TableCell className="text-fg/60">{CONTACT_SOURCE_LABEL[c.source]}</TableCell>
                    <TableCell className="text-fg/60">{c.lists.join(", ") || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="p-6 text-center text-sm text-fg/55">No subscribed contacts match these filters.</p>
          )}
        </div>
        <Pagination
          currentPage={page}
          totalPages={data?.data?.totalPages ?? 1}
          totalItems={total}
          itemsPerPage={PAGE_SIZE}
          isLoading={isFetching}
          onPageChange={setPage}
        />

        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="primary"
            onClick={() => {
              onChange([...selected]);
              onOpenChange(false);
            }}
          >
            Use {pluralize(selected.size, "contact")}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
