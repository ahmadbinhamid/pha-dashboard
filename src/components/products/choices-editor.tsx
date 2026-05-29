import { useRef, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { cn } from "@/utils/cn";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { Choice } from "@/types/product";

interface ChoicesEditorProps {
  choices: Choice[];
  onChange: (choices: Choice[]) => void;
}

function ChoiceRow({
  choice,
  onUpdate,
  onRemove,
}: {
  choice: Choice;
  onUpdate: (updated: Choice) => void;
  onRemove: () => void;
}) {
  const [inputValue, setInputValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addItem = (raw: string) => {
    const val = raw.replace(/,$/, "").trim();
    if (!val || choice.items.includes(val)) return;
    onUpdate({ ...choice, items: [...choice.items, val] });
    setInputValue("");
  };

  const removeItem = (idx: number) => {
    onUpdate({ ...choice, items: choice.items.filter((_, i) => i !== idx) });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addItem(inputValue);
    } else if (e.key === "Backspace" && !inputValue && choice.items.length > 0) {
      removeItem(choice.items.length - 1);
    }
  };

  return (
    <div className="rounded-xs border border-border bg-bg p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <Input
          className="min-w-0 flex-1"
          placeholder="Option name (e.g. Size)"
          value={choice.name}
          onChange={(e) => onUpdate({ ...choice, name: e.target.value })}
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onRemove}
          className="h-9 w-9 shrink-0 p-0 text-fg/40 hover:bg-danger/10 hover:text-danger"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      <div
        className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-xs border border-border bg-bg px-2.5 py-1.5 cursor-text"
        onClick={() => inputRef.current?.focus()}
      >
        {choice.items.map((item, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent ring-1 ring-inset ring-accent/25"
          >
            {item}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeItem(idx);
              }}
              className="ml-0.5 text-accent/60 hover:text-accent"
            >
              ×
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          className="min-w-20 flex-1 bg-transparent text-sm outline-none placeholder:text-fg/40"
          placeholder={choice.items.length === 0 ? "Add values (press Enter or comma)" : "Add more..."}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (inputValue.trim()) addItem(inputValue);
          }}
        />
      </div>
    </div>
  );
}

export function ChoicesEditor({ choices, onChange }: ChoicesEditorProps) {
  const update = (idx: number, updated: Choice) => {
    const next = [...choices];
    next[idx] = updated;
    onChange(next);
  };

  const remove = (idx: number) => {
    onChange(choices.filter((_, i) => i !== idx));
  };

  const addOption = () => {
    onChange([...choices, { name: "", items: [] }]);
  };

  return (
    <div className="space-y-3">
      {choices.length === 0 ? (
        <p className="text-sm text-fg/45">
          No options yet. Add an option to create variants like Size or Color.
        </p>
      ) : (
        choices.map((choice, idx) => (
          <ChoiceRow
            key={idx}
            choice={choice}
            onUpdate={(updated) => update(idx, updated)}
            onRemove={() => remove(idx)}
          />
        ))
      )}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={addOption}
        className="w-full gap-1.5 border border-dashed border-border text-fg/55 hover:border-fg/25 hover:bg-transparent hover:text-fg/80"
      >
        <Plus className="h-3.5 w-3.5" />
        Add option
      </Button>
    </div>
  );
}
