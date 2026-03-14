export interface InlineToken {
  text: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

export type Block =
  | { type: "paragraph"; tokens: InlineToken[] }
  | { type: "bullet"; tokens: InlineToken[] }
  | { type: "numbered"; n: number; tokens: InlineToken[] }
  | { type: "spacer" };

export function parseRichText(text: string | null | undefined): Block[] {
  if (!text) return [];
  const lines = text.split("\n");
  const blocks: Block[] = [];

  for (const rawLine of lines) {
    if (rawLine.trim() === "") {
      blocks.push({ type: "spacer" });
      continue;
    }

    const bulletMatch = rawLine.match(/^-\s+(.*)$/);
    if (bulletMatch) {
      blocks.push({ type: "bullet", tokens: parseInline(bulletMatch[1]) });
      continue;
    }

    const numberedMatch = rawLine.match(/^(\d+)\.\s+(.*)$/);
    if (numberedMatch) {
      blocks.push({ type: "numbered", n: parseInt(numberedMatch[1], 10), tokens: parseInline(numberedMatch[2]) });
      continue;
    }

    blocks.push({ type: "paragraph", tokens: parseInline(rawLine) });
  }

  return blocks;
}

export function parseInline(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  let i = 0;
  let currentText = "";
  let bold = false;
  let italic = false;
  let underline = false;

  function flush() {
    if (currentText) {
      tokens.push({ text: currentText, bold, italic, underline });
      currentText = "";
    }
  }

  while (i < text.length) {
    if (text[i] === "*" && text[i + 1] === "*") {
      flush();
      bold = !bold;
      i += 2;
      continue;
    }
    if (text[i] === "*") {
      flush();
      italic = !italic;
      i += 1;
      continue;
    }
    if (text[i] === "_" && text[i + 1] === "_") {
      flush();
      underline = !underline;
      i += 2;
      continue;
    }
    currentText += text[i];
    i++;
  }

  flush();
  return tokens;
}

export function isAllBold(tokens: InlineToken[]): boolean {
  return tokens.length > 0 && tokens.every((t) => t.bold);
}

export function tokensToPlainText(tokens: InlineToken[]): string {
  return tokens.map((t) => t.text).join("");
}
