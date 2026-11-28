import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Upload, UserCheck } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
import { FormField } from "@/components/ui/FormField";
import { InlineNotice } from "@/components/ui/InlineNotice";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { ContactImportModal } from "@/components/campaigns/ContactImportModal";
import { ContactPickerModal } from "@/components/campaigns/ContactPickerModal";
import { AUDIENCE_OPTIONS, CAMPAIGNS_BASE_PATH } from "@/config/campaigns";
import { PERMISSIONS } from "@/config/permissions";
import { useMyAccess } from "@/hooks/useMyAccess";
import { CONTACTS_QUERY_KEY, getAudienceCount, getContactLists } from "@/lib/api/campaigns";
import { pluralize } from "@/utils/format";
import type { AudienceType, CampaignAudience, Contact } from "@/types/campaign";

interface CampaignAudienceCardProps {
  audience: CampaignAudience;
  onChange: (audience: CampaignAudience) => void;
  // Saved picks with names, so chips show emails before any re-fetch.
  knownContacts: Contact[];
  canEdit: boolean;
  error?: string;
}

const CHIP_LIMIT = 6;
const CONTACTS_TAB = `${CAMPAIGNS_BASE_PATH}?tab=contacts`;

export function CampaignAudienceCard({ audience, onChange, knownContacts, canEdit, error }: CampaignAudienceCardProps) {
  const { can } = useMyAccess();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const importLists = useMemo(() => [`Import ${new Date().toLocaleDateString("en-AU")}`], []);

  const { data: listsRes } = useQuery({ queryKey: [...CONTACTS_QUERY_KEY, "lists"], queryFn: getContactLists });
  const { data: countRes } = useQuery({
    queryKey: [...CONTACTS_QUERY_KEY, "audience-count", audience],
    queryFn: () => getAudienceCount(audience),
  });
  const count = countRes?.data?.count;
  const limit = countRes?.data?.limit;
  const overLimit = count !== undefined && limit !== undefined && count > limit;

  const listOptions = (listsRes?.data ?? []).map((l) => ({ value: l.name, label: `${l.name} (${l.subscribed})` }));
  const known = new Map(knownContacts.map((c) => [c._id, c.email]));
  const chips = audience.contact_ids.slice(0, CHIP_LIMIT).map((id) => known.get(id)).filter(Boolean);

  const setType = (type: AudienceType) => onChange({ ...audience, type });
  const description =
    count === undefined
      ? "Only subscribed contacts receive campaigns"
      : `${pluralize(count, "subscribed contact")}${limit ? ` · up to ${limit} per send` : ""}`;

  return (
    <Card>
      <CardHeader
        title="Audience"
        description={description}
        right={
          can(PERMISSIONS.campaigns.create) && canEdit ? (
            <Button type="button" variant="secondary" size="sm" onClick={() => setImportOpen(true)}>
              <Upload className="h-4 w-4" />
              Import contacts
            </Button>
          ) : undefined
        }
      />
      <CardContent className="space-y-4">
        <SegmentedControl options={AUDIENCE_OPTIONS} value={audience.type} onChange={setType} ariaLabel="Audience" />

        {audience.type === "lists" ? (
          <FormField label="Lists" required error={error} hint="Lists are tags on contacts. Manage them on the Contacts tab">
            <MultiSelect
              options={listOptions}
              value={audience.lists}
              onChange={(lists) => onChange({ ...audience, lists })}
              placeholder={listOptions.length ? "Pick lists…" : "No lists yet: import contacts or tag them"}
              disabled={!canEdit}
            />
          </FormField>
        ) : null}

        {audience.type === "contacts" ? (
          <FormField label="Contacts" required error={error}>
            <div className="space-y-2 rounded-xl border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-fg/70">
                  <span className="font-medium text-fg">{audience.contact_ids.length}</span> picked
                </span>
                <Button type="button" variant="secondary" size="sm" disabled={!canEdit} onClick={() => setPickerOpen(true)}>
                  <UserCheck className="h-4 w-4" />
                  {audience.contact_ids.length ? "Edit selection" : "Choose contacts"}
                </Button>
              </div>
              {chips.length ? (
                <div className="flex flex-wrap gap-1">
                  {chips.map((email) => (
                    <Badge key={email} variant="outline">
                      {email}
                    </Badge>
                  ))}
                  {audience.contact_ids.length > chips.length ? (
                    <Badge variant="muted">+{audience.contact_ids.length - chips.length} more</Badge>
                  ) : null}
                </div>
              ) : null}
            </div>
          </FormField>
        ) : null}

        {overLimit ? (
          <InlineNotice variant="danger">
            That's {count} people; one send can reach at most {limit}. Narrow it with lists or pick contacts.
          </InlineNotice>
        ) : null}
        <p className="text-xs text-fg/55">
          Contacts come from website signups, imports and customers who opted in.{" "}
          <Link to={CONTACTS_TAB} className="font-medium text-accent hover:underline">
            View all contacts and lists
          </Link>
        </p>
      </CardContent>

      <ContactPickerModal
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        value={audience.contact_ids}
        onChange={(contact_ids) => onChange({ ...audience, type: "contacts", contact_ids })}
      />
      <ContactImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        defaultLists={importLists}
        onImported={(lists) => {
          if (lists.length) onChange({ ...audience, type: "lists", lists: [...new Set([...audience.lists, ...lists])] });
        }}
      />
    </Card>
  );
}
