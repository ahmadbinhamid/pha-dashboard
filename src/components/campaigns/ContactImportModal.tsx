import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FileSpreadsheet, Upload } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { TagInput } from "@/components/ui/TagInput";
import { IMPORT_ACCEPT, IMPORT_COLUMNS_HINT, IMPORT_MAX_MB } from "@/config/campaigns";
import { useToast } from "@/context";
import { CONTACTS_QUERY_KEY, importContacts } from "@/lib/api/campaigns";
import { formatBytes, pluralize } from "@/utils/format";
import type { ContactImportResult } from "@/types/campaign";

interface ContactImportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Pre-filled list names, e.g. so a campaign can target what it imports.
  defaultLists?: string[];
  onImported?: (lists: string[]) => void;
}

function summarize(r: ContactImportResult) {
  const parts = [`${pluralize(r.created, "new contact")}`, `${r.updated} updated`];
  if (r.unsubscribed) parts.push(`${r.unsubscribed} kept unsubscribed`);
  if (r.invalid) parts.push(`${pluralize(r.invalid, "invalid email")} skipped`);
  if (r.duplicates) parts.push(`${pluralize(r.duplicates, "duplicate row")} merged`);
  return parts.join(" · ");
}

export function ContactImportModal({ open, onOpenChange, defaultLists, onImported }: ContactImportModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [lists, setLists] = useState<string[]>([]);
  const [result, setResult] = useState<ContactImportResult | null>(null);

  useEffect(() => {
    if (open) setLists(defaultLists ?? []);
  }, [open, defaultLists]);

  const mutation = useMutation({
    mutationFn: () => importContacts(file!, lists),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: CONTACTS_QUERY_KEY });
      setResult(res.data);
      onImported?.(lists);
    },
    onError: (err: Error) => toast({ title: "Import failed", description: err.message, tone: "danger" }),
  });

  function handleOpenChange(next: boolean) {
    if (!next) {
      setFile(null);
      setLists([]);
      setResult(null);
      mutation.reset();
    }
    onOpenChange(next);
  }

  function pickFile(picked: File | undefined) {
    if (!picked) return;
    if (picked.size > IMPORT_MAX_MB * 1024 * 1024) {
      toast({ title: `Files can be at most ${IMPORT_MAX_MB} MB`, tone: "danger" });
      return;
    }
    setFile(picked);
    setResult(null);
  }

  return (
    <Modal open={open} onOpenChange={handleOpenChange}>
      <ModalContent>
        <ModalHeader>
          <ModalTitle>Import contacts</ModalTitle>
          <ModalDescription>Upload an Excel (.xlsx) or CSV file. Columns: {IMPORT_COLUMNS_HINT}.</ModalDescription>
        </ModalHeader>

        {result ? (
          <InlineNotice variant="ok">
            Imported {pluralize(result.total, "contact")}: {summarize(result)}.
          </InlineNotice>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-4">
              <FileSpreadsheet className="h-8 w-8 shrink-0 text-fg/40" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-fg">{file?.name ?? "No file chosen"}</div>
                <div className="text-xs text-fg/50">{file ? formatBytes(file.size) : `Up to ${IMPORT_MAX_MB} MB`}</div>
              </div>
              <Button type="button" variant="secondary" size="sm" onClick={() => fileInputRef.current?.click()}>
                {file ? "Change" : "Choose file"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept={IMPORT_ACCEPT}
                className="hidden"
                onChange={(e) => {
                  pickFile(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
            </div>
            <FormField label="Add everyone to lists" hint="Optional. Target these lists from a campaign later">
              <TagInput value={lists} onChange={setLists} placeholder="e.g. Trade show 2026" />
            </FormField>
            <p className="text-xs text-fg/55">
              Only import people who agreed to receive marketing email. Anyone who unsubscribed stays unsubscribed.
            </p>
          </div>
        )}

        <ModalFooter>
          {result ? (
            <Button type="button" variant="primary" onClick={() => handleOpenChange(false)}>
              Done
            </Button>
          ) : (
            <>
              <Button type="button" variant="secondary" onClick={() => handleOpenChange(false)}>
                Cancel
              </Button>
              <Button type="button" variant="primary" disabled={!file || mutation.isPending} onClick={() => mutation.mutate()}>
                <Upload className="h-4 w-4" />
                {mutation.isPending ? "Importing…" : "Import"}
              </Button>
            </>
          )}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
