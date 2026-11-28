import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import TextAlign from "@tiptap/extension-text-align";
import Color from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import Placeholder from "@tiptap/extension-placeholder";
import Underline from "@tiptap/extension-underline";
import Image from "@tiptap/extension-image";
import { useEffect, useCallback } from "react";
import { cn } from "@/utils/cn";
import { RichTextLinkPopover } from "@/components/ui/RichTextLinkPopover";
import { RichTextToolbarButton } from "@/components/ui/RichTextToolbarButton";
import { useImageUpload } from "@/hooks/useImageUpload";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Undo2,
  Redo2,
  RemoveFormatting,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  ImagePlus,
  Loader2,
} from "lucide-react";

interface RichTextEditorProps {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
  readOnly?: boolean;
  // Opt-in, so short fields (policies, descriptions) keep a lean toolbar.
  enableLinks?: boolean;
  enableImages?: boolean;
}

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;

function ToolbarDivider() {
  return <div className="mx-0.5 h-5 w-px bg-border" />;
}

export function RichTextEditor({
  value = "",
  onChange,
  placeholder = "Write something...",
  className,
  minHeight = "160px",
  readOnly = false,
  enableLinks = false,
  enableImages = false,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true, defaultProtocol: "https" },
      }),
      ...(enableImages ? [Image.configure({ HTMLAttributes: { loading: "lazy" } })] : []),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Color,
      TextStyle,
      Placeholder.configure({ placeholder }),
      Underline,
    ],
    content: value,
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value]);

  const imageUpload = useImageUpload({
    maxBytes: IMAGE_MAX_BYTES,
    onUploaded: (src) => editor?.chain().focus().setImage({ src }).run(),
  });

  const setHeading = useCallback(
    (level: 1 | 2 | 3) => {
      if (!editor) return;
      if (editor.isActive("heading", { level })) {
        editor.chain().focus().setParagraph().run();
      } else {
        editor.chain().focus().toggleHeading({ level }).run();
      }
    },
    [editor],
  );

  if (!editor) return null;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-border bg-card shadow-(--shadow-input)",
        "focus-within:border-accent focus-within:shadow-(--shadow-input-focus)",
        className,
      )}
    >
      {!readOnly && (
        <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-bg-2/50 px-2 py-1.5">
          <RichTextToolbarButton
            title="Undo"
            disabled={!editor.can().undo()}
            onClick={() => editor.chain().focus().undo().run()}
          >
            <Undo2 className="h-3.5 w-3.5" />
          </RichTextToolbarButton>
          <RichTextToolbarButton
            title="Redo"
            disabled={!editor.can().redo()}
            onClick={() => editor.chain().focus().redo().run()}
          >
            <Redo2 className="h-3.5 w-3.5" />
          </RichTextToolbarButton>

          <ToolbarDivider />

          <RichTextToolbarButton
            title="Paragraph"
            active={editor.isActive("paragraph")}
            onClick={() => editor.chain().focus().setParagraph().run()}
          >
            <Pilcrow className="h-3.5 w-3.5" />
          </RichTextToolbarButton>
          <RichTextToolbarButton
            title="Heading 1"
            active={editor.isActive("heading", { level: 1 })}
            onClick={() => setHeading(1)}
          >
            <Heading1 className="h-3.5 w-3.5" />
          </RichTextToolbarButton>
          <RichTextToolbarButton
            title="Heading 2"
            active={editor.isActive("heading", { level: 2 })}
            onClick={() => setHeading(2)}
          >
            <Heading2 className="h-3.5 w-3.5" />
          </RichTextToolbarButton>
          <RichTextToolbarButton
            title="Heading 3"
            active={editor.isActive("heading", { level: 3 })}
            onClick={() => setHeading(3)}
          >
            <Heading3 className="h-3.5 w-3.5" />
          </RichTextToolbarButton>

          <ToolbarDivider />

          <RichTextToolbarButton
            title="Bold"
            active={editor.isActive("bold")}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="h-3.5 w-3.5" />
          </RichTextToolbarButton>
          <RichTextToolbarButton
            title="Italic"
            active={editor.isActive("italic")}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="h-3.5 w-3.5" />
          </RichTextToolbarButton>
          <RichTextToolbarButton
            title="Underline"
            active={editor.isActive("underline")}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="h-3.5 w-3.5" />
          </RichTextToolbarButton>

          <ToolbarDivider />

          <RichTextToolbarButton
            title="Bullet list"
            active={editor.isActive("bulletList")}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="h-3.5 w-3.5" />
          </RichTextToolbarButton>
          <RichTextToolbarButton
            title="Ordered list"
            active={editor.isActive("orderedList")}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="h-3.5 w-3.5" />
          </RichTextToolbarButton>

          <ToolbarDivider />

          <RichTextToolbarButton
            title="Align left"
            active={editor.isActive({ textAlign: "left" })}
            onClick={() => editor.chain().focus().setTextAlign("left").run()}
          >
            <AlignLeft className="h-3.5 w-3.5" />
          </RichTextToolbarButton>
          <RichTextToolbarButton
            title="Align center"
            active={editor.isActive({ textAlign: "center" })}
            onClick={() => editor.chain().focus().setTextAlign("center").run()}
          >
            <AlignCenter className="h-3.5 w-3.5" />
          </RichTextToolbarButton>
          <RichTextToolbarButton
            title="Align right"
            active={editor.isActive({ textAlign: "right" })}
            onClick={() => editor.chain().focus().setTextAlign("right").run()}
          >
            <AlignRight className="h-3.5 w-3.5" />
          </RichTextToolbarButton>
          <RichTextToolbarButton
            title="Justify"
            active={editor.isActive({ textAlign: "justify" })}
            onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          >
            <AlignJustify className="h-3.5 w-3.5" />
          </RichTextToolbarButton>

          <ToolbarDivider />

          {enableLinks || enableImages ? (
            <>
              {enableLinks ? <RichTextLinkPopover editor={editor} /> : null}
              {enableImages ? (
                <RichTextToolbarButton title="Insert image" disabled={imageUpload.isUploading} onClick={imageUpload.open}>
                  {imageUpload.isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
                  <input {...imageUpload.inputProps} />
                </RichTextToolbarButton>
              ) : null}
              <ToolbarDivider />
            </>
          ) : null}

          <RichTextToolbarButton
            title="Remove formatting"
            onClick={() =>
              editor.chain().focus().clearNodes().unsetAllMarks().run()
            }
          >
            <RemoveFormatting className="h-3.5 w-3.5" />
          </RichTextToolbarButton>
        </div>
      )}

      <EditorContent
        editor={editor}
        className="rich-text-editor-content"
        style={{ minHeight }}
      />
    </div>
  );
}
