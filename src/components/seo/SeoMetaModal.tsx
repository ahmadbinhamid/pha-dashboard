import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalContent, ModalDescription, ModalFooter, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { SeoMetaFields } from "@/components/seo/SeoMetaFields";
import { EMPTY_SEO_META } from "@/config/seo";
import type { SeoMeta, SeoMetaTarget } from "@/types/seo";

interface SeoMetaModalProps {
  target: SeoMetaTarget | null;
  onOpenChange: (open: boolean) => void;
  saving: boolean;
  canEdit: boolean;
  onSave: (seo: SeoMeta) => void;
}

/** Edits one product's or category's search and social overrides. */
export function SeoMetaModal({ target, onOpenChange, saving, canEdit, onSave }: SeoMetaModalProps) {
  const [seo, setSeo] = useState<SeoMeta>(EMPTY_SEO_META);

  useEffect(() => {
    if (target) setSeo({ ...EMPTY_SEO_META, ...target.seo });
  }, [target]);

  return (
    <Modal open={!!target} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-2xl">
        <ModalHeader>
          <ModalTitle>{target?.name}</ModalTitle>
          <ModalDescription>Blank fields use the name and description from the catalogue.</ModalDescription>
        </ModalHeader>
        <div className="max-h-[65vh] overflow-y-auto pr-1">
          {target ? (
            <SeoMetaFields
              value={seo}
              onChange={setSeo}
              fallbackTitle={target.name}
              fallbackDescription={target.fallbackDescription}
              path={target.path}
              disabled={!canEdit}
            />
          ) : null}
        </div>
        <ModalFooter>
          <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>
            {canEdit ? "Cancel" : "Close"}
          </Button>
          {canEdit ? (
            <Button type="button" variant="primary" disabled={saving} onClick={() => onSave(seo)}>
              {saving ? "Saving…" : "Save"}
            </Button>
          ) : null}
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
