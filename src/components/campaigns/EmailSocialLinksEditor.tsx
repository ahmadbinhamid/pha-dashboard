import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { SingleSelect } from "@/components/ui/SingleSelect";
import { SOCIAL_NETWORK_OPTIONS } from "@/config/emailBuilder";
import type { SocialLink, SocialNetwork } from "@/types/campaign";

interface EmailSocialLinksEditorProps {
  links: SocialLink[];
  onChange: (links: SocialLink[]) => void;
}

const MAX_LINKS = SOCIAL_NETWORK_OPTIONS.length;

export function EmailSocialLinksEditor({ links, onChange }: EmailSocialLinksEditorProps) {
  const update = (i: number, patch: Partial<SocialLink>) => onChange(links.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const unused = SOCIAL_NETWORK_OPTIONS.find((o) => !links.some((l) => l.network === o.value));

  return (
    <div className="space-y-2">
      {links.map((link, i) => (
        <div key={i} className="space-y-1.5 rounded-lg border border-border p-2">
          <div className="flex items-center gap-1.5">
            <SingleSelect
              size="sm"
              options={SOCIAL_NETWORK_OPTIONS}
              value={link.network}
              onChange={(v) => update(i, { network: v as SocialNetwork })}
              className="flex-1"
            />
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7" aria-label="Remove link" onClick={() => onChange(links.filter((_, j) => j !== i))}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Input size="sm" placeholder="https://…" value={link.url} onChange={(e) => update(i, { url: e.target.value })} />
        </div>
      ))}
      <p className="text-2xs text-fg/50">Links without a URL are left out of the email.</p>
      {links.length < MAX_LINKS && unused ? (
        <Button type="button" variant="secondary" size="sm" onClick={() => onChange([...links, { network: unused.value, url: "" }])}>
          <Plus className="h-3.5 w-3.5" />
          Add link
        </Button>
      ) : null}
    </div>
  );
}
