import { useRef } from "react";
import { Bold, Italic, Underline, List, ListOrdered } from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  "data-testid"?: string;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  rows = 4,
  placeholder,
  "data-testid": testId,
  className,
}: RichTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function applyInlineFormat(marker: string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: ss, selectionEnd: se } = el;
    const selected = value.slice(ss, se);
    const before = value.slice(0, ss);
    const after = value.slice(se);
    const newValue = `${before}${marker}${selected}${marker}${after}`;
    onChange(newValue);
    setTimeout(() => {
      el.focus();
      const cursor = ss + marker.length + selected.length + marker.length;
      el.setSelectionRange(cursor, cursor);
    }, 0);
  }

  function applyLinePrefix(buildPrefix: (n: number) => string) {
    const el = textareaRef.current;
    if (!el) return;
    const { selectionStart: ss, selectionEnd: se } = el;
    let lineStart = ss;
    while (lineStart > 0 && value[lineStart - 1] !== "\n") lineStart--;
    const before = value.slice(0, lineStart);
    const region = value.slice(lineStart, se);
    const after = value.slice(se);
    let counter = 1;
    const processed = region
      .split("\n")
      .map((line) => `${buildPrefix(counter++)}${line}`)
      .join("\n");
    onChange(`${before}${processed}${after}`);
    setTimeout(() => el.focus(), 0);
  }

  const toolbarBtn = "inline-flex items-center justify-center w-7 h-7 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors cursor-pointer select-none border border-transparent hover:border-border";

  return (
    <div className={cn("flex flex-col gap-0", className)}>
      <div className="flex items-center gap-0.5 px-1.5 py-1 border border-b-0 rounded-t-md bg-muted/40">
        <button
          type="button"
          className={toolbarBtn}
          title="Bold (**text**)"
          onClick={() => applyInlineFormat("**")}
          data-testid={testId ? `${testId}-bold` : undefined}
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className={toolbarBtn}
          title="Italic (*text*)"
          onClick={() => applyInlineFormat("*")}
          data-testid={testId ? `${testId}-italic` : undefined}
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className={toolbarBtn}
          title="Underline (__text__)"
          onClick={() => applyInlineFormat("__")}
          data-testid={testId ? `${testId}-underline` : undefined}
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
        <div className="w-px h-4 bg-border mx-0.5" />
        <button
          type="button"
          className={toolbarBtn}
          title="Bullet list (- item)"
          onClick={() => applyLinePrefix(() => "- ")}
          data-testid={testId ? `${testId}-bullet` : undefined}
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className={toolbarBtn}
          title="Numbered list (1. item)"
          onClick={() => applyLinePrefix((n) => `${n}. `)}
          data-testid={testId ? `${testId}-numbered` : undefined}
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <div className="ml-auto text-[10px] text-muted-foreground/60 pr-1 hidden sm:block">
          **bold** *italic* __underline__ &nbsp;- bullet &nbsp;1. numbered
        </div>
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        data-testid={testId}
        className="flex w-full rounded-b-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-y font-mono text-xs leading-relaxed"
      />
    </div>
  );
}
