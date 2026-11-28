import { useState } from "react";
import type { Editor } from "@tiptap/react";
import { Link2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/Popover";
import { RichTextToolbarButton } from "@/components/ui/RichTextToolbarButton";

// A bare "example.com" would otherwise become a relative link.
function withProtocol(url: string) {
  const trimmed = url.trim();
  if (!trimmed || /^(https?:|mailto:|tel:|\/|#)/i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

/** Toolbar button that adds, edits or removes a link on the selection. */
export function RichTextLinkPopover({ editor }: { editor: Editor }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const active = editor.isActive("link");

  function handleOpenChange(next: boolean) {
    if (next) setUrl((editor.getAttributes("link").href as string | undefined) ?? "");
    setOpen(next);
  }

  function apply() {
    const href = withProtocol(url);
    const chain = editor.chain().focus().extendMarkRange("link");
    if (href) chain.setLink({ href }).run();
    else chain.unsetLink().run();
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <RichTextToolbarButton title="Link" active={active}>
          <Link2 className="h-3.5 w-3.5" />
        </RichTextToolbarButton>
      </PopoverTrigger>
      <PopoverContent className="w-80 space-y-2 p-3">
        <Input
          size="sm"
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
          placeholder="https://… or /shop"
        />
        <div className="flex justify-end gap-2">
          {active ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                setOpen(false);
              }}
            >
              Remove
            </Button>
          ) : null}
          <Button type="button" size="sm" onClick={apply}>
            {active ? "Update" : "Add link"}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
