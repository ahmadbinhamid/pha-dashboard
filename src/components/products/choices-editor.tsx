import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, Trash2 } from "lucide-react";

export interface Choice {
  name: string;
  items: string[];
}

interface ChoicesEditorProps {
  choices: Choice[];
  onChange: (choices: Choice[]) => void;
}

export function ChoicesEditor({ choices, onChange }: ChoicesEditorProps) {
  const [newOptionName, setNewOptionName] = useState("");
  const [newOptionItems, setNewOptionItems] = useState("");

  const addOption = () => {
    const name = newOptionName.trim();
    const items = newOptionItems
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!name || !items.length) return;
    if (choices.find((c) => c.name.toLowerCase() === name.toLowerCase()))
      return;

    onChange([...choices, { name, items }]);
    setNewOptionName("");
    setNewOptionItems("");
  };

  const removeOption = (idx: number) => {
    onChange(choices.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-3">
      {choices.map((choice, idx) => (
        <div
          key={idx}
          className="flex items-start gap-2 rounded-lg border border-border p-3"
        >
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">{choice.name}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {choice.items.map((item) => (
                <span
                  key={item}
                  className="rounded-full bg-bg-2 px-2 py-0.5 text-xs ring-1 ring-inset ring-border"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => removeOption(idx)}
            className="shrink-0 text-fg/40 hover:text-danger"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Input
          placeholder="Option name (e.g. Size)"
          value={newOptionName}
          onChange={(e) => setNewOptionName(e.target.value)}
        />
        <Input
          placeholder="Values: S, M, L, XL"
          value={newOptionItems}
          onChange={(e) => setNewOptionItems(e.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="gap-1.5"
          onClick={addOption}
        >
          <Plus className="h-3.5 w-3.5" />
          Add option
        </Button>
      </div>
    </div>
  );
}
