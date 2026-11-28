import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, LayoutTemplate, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { CampaignTemplateTile } from "@/components/campaigns/CampaignTemplateTile";
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
              <CampaignTemplateTile
                icon={FilePlus2}
                title="Blank"
                description="Start from an empty email"
                onClick={() => pick(emptyDesign())}
                subtle
              />
              {STARTER_TEMPLATES.map((t) => (
                <CampaignTemplateTile key={t.key} icon={LayoutTemplate} title={t.name} description={t.description} onClick={() => pick(t.design)} />
              ))}
            </div>
          </section>
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-fg/50">Your templates</h3>
            {saved.length ? (
              <div className="grid gap-2 sm:grid-cols-2">
                {saved.map((t) => (
                  <div key={t._id} className="relative">
                    <CampaignTemplateTile
                      icon={LayoutTemplate}
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
