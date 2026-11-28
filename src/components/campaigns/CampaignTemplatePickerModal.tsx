import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, LayoutTemplate, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal, ModalContent, ModalDescription, ModalHeader, ModalTitle } from "@/components/ui/Modal";
import { STARTER_TEMPLATES } from "@/config/campaignTemplates";
import { PERMISSIONS } from "@/config/permissions";
import { useToast } from "@/context";
import { useMyAccess } from "@/hooks/useMyAccess";
import { TEMPLATES_QUERY_KEY, deleteTemplate, getTemplates } from "@/lib/api/campaigns";
import { cloneDesign, emptyDesign } from "@/lib/campaigns/emailDesign";
import { pluralize } from "@/utils/format";
import type { EmailDesign } from "@/types/campaign";

interface CampaignTemplatePickerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (design: EmailDesign) => void;
}

function TemplateTile({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-start gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:border-accent/60 hover:bg-bg-2"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <LayoutTemplate className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-fg">{title}</span>
        <span className="block text-xs text-fg/55">{description}</span>
      </span>
    </button>
  );
}

export function CampaignTemplatePickerModal({ open, onOpenChange, onPick }: CampaignTemplatePickerModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { can } = useMyAccess();
  const { data } = useQuery({ queryKey: TEMPLATES_QUERY_KEY, queryFn: getTemplates, enabled: open });
  const saved = data?.data ?? [];

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: TEMPLATES_QUERY_KEY });
      toast({ title: "Template deleted", tone: "success" });
    },
    onError: (err: Error) => toast({ title: "Couldn't delete the template", description: err.message, tone: "danger" }),
  });

  const pick = (design: EmailDesign) => {
    onPick(cloneDesign(design));
    onOpenChange(false);
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-2xl">
        <ModalHeader>
          <ModalTitle>Choose a template</ModalTitle>
          <ModalDescription>Replaces the current design. You can change every block afterwards.</ModalDescription>
        </ModalHeader>
        <div className="max-h-[65vh] space-y-5 overflow-y-auto">
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-fg/50">Starters</h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => pick(emptyDesign())}
                className="flex w-full items-start gap-3 rounded-xl border border-dashed border-border p-3 text-left transition hover:border-accent/60 hover:bg-bg-2"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-bg-2 text-fg/60">
                  <FilePlus2 className="h-4 w-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-fg">Blank</span>
                  <span className="block text-xs text-fg/55">Start from an empty email</span>
                </span>
              </button>
              {STARTER_TEMPLATES.map((t) => (
                <TemplateTile key={t.key} title={t.name} description={t.description} onClick={() => pick(t.design)} />
              ))}
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-fg/50">Your templates</h3>
            {saved.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {saved.map((t) => (
                  <div key={t._id} className="relative">
                    <TemplateTile
                      title={t.name}
                      description={`${pluralize(t.design.blocks.length, "block")} · saved ${new Date(t.updated_at).toLocaleDateString()}`}
                      onClick={() => pick(t.design)}
                    />
                    {can(PERMISSIONS.campaigns.delete) ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-2 top-2 h-7 w-7"
                        aria-label={`Delete ${t.name}`}
                        disabled={deleteMutation.isPending}
                        onClick={() => deleteMutation.mutate(t._id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-danger" />
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-fg/55">None yet. Use "Save as template" in the designer to reuse a layout.</p>
            )}
          </section>
        </div>
      </ModalContent>
    </Modal>
  );
}
