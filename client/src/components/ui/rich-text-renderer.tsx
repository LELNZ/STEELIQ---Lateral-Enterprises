import { parseRichText, isAllBold, tokensToPlainText, type Block, type InlineToken } from "@/lib/rich-text-parser";

interface RichTextRendererProps {
  text: string | null | undefined;
  color?: string;
  className?: string;
  boldHeadings?: boolean;
}

function RenderInlineTokens({ tokens, color }: { tokens: InlineToken[]; color?: string }) {
  return (
    <>
      {tokens.map((token, i) => {
        let el: React.ReactNode = token.text;
        if (token.bold && token.italic) el = <strong key={i}><em>{el}</em></strong>;
        else if (token.bold) el = <strong key={i}>{el}</strong>;
        else if (token.italic) el = <em key={i}>{el}</em>;
        else el = <span key={i}>{el}</span>;
        if (token.underline) el = <u key={i}>{el}</u>;
        return el;
      })}
    </>
  );
}

function renderBlock(block: Block, index: number, color: string | undefined, boldHeadings: boolean): React.ReactNode {
  if (block.type === "spacer") {
    return <div key={index} style={{ height: boldHeadings ? "0.6em" : "0.4em" }} />;
  }

  if (block.type === "bullet") {
    return (
      <div key={index} className="flex gap-2 leading-relaxed text-sm">
        <span className="shrink-0 mt-0.5">•</span>
        <span style={{ color }}><RenderInlineTokens tokens={block.tokens} color={color} /></span>
      </div>
    );
  }

  if (block.type === "numbered") {
    return (
      <div key={index} className="flex gap-2 leading-relaxed text-sm">
        <span className="shrink-0 mt-0.5 tabular-nums">{block.n}.</span>
        <span style={{ color }}><RenderInlineTokens tokens={block.tokens} color={color} /></span>
      </div>
    );
  }

  const allBold = boldHeadings && isAllBold(block.tokens);

  if (allBold) {
    return (
      <p key={index} className="text-sm font-semibold leading-snug" style={{ color, marginTop: "0.5em" }}>
        <RenderInlineTokens tokens={block.tokens} color={color} />
      </p>
    );
  }

  return (
    <p key={index} className="text-sm leading-relaxed" style={{ color }}>
      <RenderInlineTokens tokens={block.tokens} color={color} />
    </p>
  );
}

export function RichTextRenderer({ text, color, className, boldHeadings = false }: RichTextRendererProps) {
  if (!text) return null;
  const blocks = parseRichText(text);
  if (blocks.length === 0) return null;

  return (
    <div className={className}>
      {blocks.map((block, i) => renderBlock(block, i, color, boldHeadings))}
    </div>
  );
}
