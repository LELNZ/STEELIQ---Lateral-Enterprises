import type { InsertQuoteItem, CustomColumn } from "@shared/schema";

const FRAME_WIN = 52;
const FRAME_SLIDE = 127;
const FRAME_BIFOLD = 70;

export function getFrameSize(category: string): number {
  if (category === "sliding-window" || category === "stacker-door") return FRAME_SLIDE;
  if (category === "bifold-door") return FRAME_BIFOLD;
  return FRAME_WIN;
}

interface PaneProps {
  x: number;
  y: number;
  w: number;
  h: number;
  frameSize: number;
  type: "fixed" | "awning" | "hinge" | "sliding" | "bifold";
  hingeSide?: string;
  halfSolid?: boolean;
  openDirection?: string;
  foldDirection?: string;
  strokeScale: number;
}

function Pane({ x, y, w, h, frameSize, type, hingeSide = "left", halfSolid = false, openDirection = "out", foldDirection = "right", strokeScale: ss }: PaneProps) {
  const inset = frameSize * 0.7;
  const gx = x + inset;
  const gy = y + inset;
  const gw = w - inset * 2;
  const gh = h - inset * 2;

  if (gw <= 0 || gh <= 0) return null;

  const midX = x + w / 2;
  const midY = y + h / 2;
  const dash = openDirection === "in" ? `${8 * ss} ${4 * ss}` : "none";

  return (
    <g>
      <rect x={x} y={y} width={w} height={h}
        fill="#fafafa" stroke="#2d2d2d" strokeWidth={2.5 * ss} />
      {halfSolid ? (
        <>
          <rect x={gx} y={gy} width={gw} height={gh / 2}
            fill="#dce8f5" stroke="#2d2d2d" strokeWidth={1 * ss} />
          <rect x={gx} y={gy + gh / 2} width={gw} height={gh / 2}
            fill="url(#hatch)" stroke="#2d2d2d" strokeWidth={1 * ss} />
          <line x1={gx} y1={gy + gh / 2} x2={gx + gw} y2={gy + gh / 2}
            stroke="#2d2d2d" strokeWidth={2 * ss} />
        </>
      ) : (
        <rect x={gx} y={gy} width={gw} height={gh}
          fill="#dce8f5" stroke="#2d2d2d" strokeWidth={1 * ss} />
      )}

      {type === "awning" && (
        <>
          <polyline
            points={`${gx},${gy + gh} ${midX},${gy} ${gx + gw},${gy + gh}`}
            fill="none" stroke="#2d2d2d" strokeWidth={1 * ss}
            strokeDasharray={dash} />
          <line
            x1={midX - Math.min(gw * 0.08, 20)} y1={gy + gh - inset * 0.3}
            x2={midX + Math.min(gw * 0.08, 20)} y2={gy + gh - inset * 0.3}
            stroke="#2d2d2d" strokeWidth={2.5 * ss} strokeLinecap="round" />
        </>
      )}

      {type === "hinge" && hingeSide === "left" && (
        <polyline
          points={`${gx + gw},${gy} ${gx},${midY} ${gx + gw},${gy + gh}`}
          fill="none" stroke="#2d2d2d" strokeWidth={1 * ss}
          strokeDasharray={dash} />
      )}

      {type === "hinge" && hingeSide === "right" && (
        <polyline
          points={`${gx},${gy} ${gx + gw},${midY} ${gx},${gy + gh}`}
          fill="none" stroke="#2d2d2d" strokeWidth={1 * ss}
          strokeDasharray={dash} />
      )}

      {type === "sliding" && (() => {
        const arrowLen = gw * 0.25;
        const headSize = Math.min(gh * 0.025, 12);
        return (
          <g>
            <line x1={midX - arrowLen} y1={midY} x2={midX + arrowLen} y2={midY}
              stroke="#2d2d2d" strokeWidth={1.5 * ss} />
            <polyline
              points={`${midX + arrowLen - headSize * 2},${midY - headSize} ${midX + arrowLen},${midY} ${midX + arrowLen - headSize * 2},${midY + headSize}`}
              fill="#2d2d2d" stroke="#2d2d2d" strokeWidth={1.5 * ss} />
          </g>
        );
      })()}

      {type === "bifold" && (() => {
        const cw = gw * 0.15;
        const ch = gh * 0.18;
        if (foldDirection === "left") {
          return (
            <polyline
              points={`${midX + cw},${midY - ch} ${midX - cw},${midY} ${midX + cw},${midY + ch}`}
              fill="none" stroke="#2d2d2d" strokeWidth={1.2 * ss} />
          );
        }
        return (
          <polyline
            points={`${midX - cw},${midY - ch} ${midX + cw},${midY} ${midX - cw},${midY + ch}`}
            fill="none" stroke="#2d2d2d" strokeWidth={1.2 * ss} />
        );
      })()}
    </g>
  );
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function renderCustomGrid(
  W: number, H: number, customColumns: CustomColumn[],
  frameSize: number, openDir: string, ss: number
) {
  if (!customColumns || customColumns.length === 0) {
    return <Pane x={0} y={0} w={W} h={H} frameSize={frameSize} type="fixed" strokeScale={ss} />;
  }

  const totalSpecifiedWidth = customColumns.reduce((s, c) => s + (c.width || 0), 0);
  const colWidths = customColumns.map(c => {
    if (totalSpecifiedWidth > 0 && c.width > 0) return (c.width / totalSpecifiedWidth) * W;
    return W / customColumns.length;
  });
  if (totalSpecifiedWidth === 0) {
    colWidths.fill(W / customColumns.length);
  }

  const elements: JSX.Element[] = [];
  let xOffset = 0;

  for (let ci = 0; ci < customColumns.length; ci++) {
    const col = customColumns[ci];
    const colW = colWidths[ci];
    const colRows = col.rows || [{ height: 0, type: "fixed" as const }];

    const totalSpecifiedHeight = colRows.reduce((s, r) => s + (r.height || 0), 0);
    const rowHeights = colRows.map(r => {
      if (totalSpecifiedHeight > 0 && r.height > 0) return (r.height / totalSpecifiedHeight) * H;
      return H / colRows.length;
    });
    if (totalSpecifiedHeight === 0) {
      rowHeights.fill(H / colRows.length);
    }

    let yOffset = 0;
    for (let ri = 0; ri < colRows.length; ri++) {
      const row = colRows[ri];
      const rowH = rowHeights[ri];
      const pType = (row.type || "fixed") as PaneProps["type"];
      elements.push(
        <Pane key={`${ci}-${ri}`}
          x={xOffset} y={yOffset} w={colW} h={rowH}
          frameSize={frameSize} type={pType}
          openDirection={openDir} strokeScale={ss} />
      );
      yOffset += rowH;
    }
    xOffset += colW;
  }

  return <g>{elements}</g>;
}

function renderDrawing(config: InsertQuoteItem, frameSize: number, ss: number) {
  const {
    width: W, height: H, category, layout, hingeSide, halfSolid,
    openDirection, panels, sidelightWidth,
    bifoldLeftCount, centerWidth, windowType, customColumns
  } = config;
  const minPane = frameSize * 2;
  const od = openDirection || "out";

  if (layout === "custom") {
    return renderCustomGrid(W, H, customColumns || [], frameSize, od, ss);
  }

  if (category === "windows-standard") {
    const wt = windowType === "awning" ? "awning" : "fixed";
    return <Pane x={0} y={0} w={W} h={H} frameSize={frameSize}
      type={wt} openDirection={od} strokeScale={ss} />;
  }

  if (category === "sliding-window") {
    return (
      <g>
        <Pane x={0} y={0} w={W / 2} h={H} frameSize={frameSize} type="fixed" strokeScale={ss} />
        <Pane x={W / 2} y={0} w={W / 2} h={H} frameSize={frameSize} type="sliding" strokeScale={ss} />
      </g>
    );
  }

  if (category === "entrance-door") {
    const rawSl = sidelightWidth > 0 ? sidelightWidth : 400;
    const slW = clamp(rawSl, minPane, W - minPane);
    const doorW = W - slW;
    return (
      <g>
        <Pane x={0} y={0} w={doorW} h={H} frameSize={frameSize}
          type="hinge" hingeSide={hingeSide} halfSolid={halfSolid}
          openDirection={od} strokeScale={ss} />
        <Pane x={doorW} y={0} w={slW} h={H} frameSize={frameSize}
          type="fixed" strokeScale={ss} />
      </g>
    );
  }

  if (category === "hinge-door") {
    return <Pane x={0} y={0} w={W} h={H} frameSize={frameSize}
      type="hinge" hingeSide={hingeSide} halfSolid={halfSolid}
      openDirection={od} strokeScale={ss} />;
  }

  if (category === "french-door") {
    return (
      <g>
        <Pane x={0} y={0} w={W / 2} h={H} frameSize={frameSize}
          type="hinge" hingeSide="left" openDirection={od} strokeScale={ss} />
        <Pane x={W / 2} y={0} w={W / 2} h={H} frameSize={frameSize}
          type="hinge" hingeSide="right" openDirection={od} strokeScale={ss} />
      </g>
    );
  }

  if (category === "bifold-door") {
    const leafCount = panels || 3;
    const leftCount = bifoldLeftCount ?? Math.floor(leafCount / 2);
    const lw = W / leafCount;
    return (
      <g>
        {Array.from({ length: leafCount }).map((_, i) => (
          <Pane key={i} x={i * lw} y={0} w={lw} h={H}
            frameSize={frameSize} type="bifold"
            foldDirection={i < leftCount ? "left" : "right"}
            strokeScale={ss} />
        ))}
      </g>
    );
  }

  if (category === "stacker-door") {
    const panelCount = panels || 3;
    const pw = W / panelCount;
    return (
      <g>
        {Array.from({ length: panelCount }).map((_, i) => (
          <Pane key={i} x={i * pw} y={0} w={pw} h={H}
            frameSize={frameSize} type="sliding" strokeScale={ss} />
        ))}
      </g>
    );
  }

  if (category === "bay-window") {
    const cw = clamp(centerWidth > 0 ? centerWidth : W * 0.6, minPane, W - minPane * 2);
    const sideW = (W - cw) / 2;
    return (
      <g>
        <Pane x={0} y={0} w={sideW} h={H} frameSize={frameSize}
          type="awning" openDirection={od} strokeScale={ss} />
        <Pane x={sideW} y={0} w={cw} h={H} frameSize={frameSize}
          type="fixed" strokeScale={ss} />
        <Pane x={sideW + cw} y={0} w={sideW} h={H} frameSize={frameSize}
          type="awning" openDirection={od} strokeScale={ss} />
      </g>
    );
  }

  return <Pane x={0} y={0} w={W} h={H} frameSize={frameSize} type="fixed" strokeScale={ss} />;
}

export default function DrawingCanvas({ config }: { config: InsertQuoteItem }) {
  const { width: W, height: H, name, quantity, category } = config;
  const frameSize = getFrameSize(category);
  const maxDim = Math.max(W, H);

  const ss = maxDim / 1500;

  const dimGap = maxDim * 0.06;
  const textGap = maxDim * 0.1;
  const padLeft = maxDim * 0.16;
  const padBottom = maxDim * 0.16;
  const padRight = maxDim * 0.05;
  const padTop = maxDim * 0.1;

  const fontSize = Math.max(maxDim * 0.028, 14);
  const titleFontSize = Math.max(maxDim * 0.032, 16);
  const tickLen = maxDim * 0.012;
  const dimStroke = 1.2 * ss;
  const extStroke = 0.6 * ss;

  return (
    <svg
      viewBox={`${-padLeft} ${-padTop} ${W + padLeft + padRight} ${H + padTop + padBottom}`}
      className="w-full h-full"
      style={{ maxHeight: "100%", background: "white" }}
      data-testid="drawing-canvas"
    >
      <defs>
        <pattern id="hatch" patternUnits="userSpaceOnUse" width={8 * ss} height={8 * ss}
          patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={8 * ss} stroke="#999" strokeWidth={0.8 * ss} />
        </pattern>
      </defs>

      <text x={W / 2} y={-padTop * 0.35} textAnchor="middle"
        fontSize={titleFontSize} fontWeight="600" fill="#2d2d2d" fontFamily="sans-serif"
        data-testid="text-item-title">
        {name || "Untitled"} (Qty: {quantity})
      </text>

      {renderDrawing(config, frameSize, ss)}

      <g data-testid="dimension-width">
        <line x1={0} y1={H + 2} x2={0} y2={H + dimGap + tickLen} stroke="#555" strokeWidth={extStroke} />
        <line x1={W} y1={H + 2} x2={W} y2={H + dimGap + tickLen} stroke="#555" strokeWidth={extStroke} />
        <line x1={0} y1={H + dimGap} x2={W} y2={H + dimGap} stroke="#555" strokeWidth={dimStroke} />
        <line x1={-tickLen} y1={H + dimGap + tickLen} x2={tickLen} y2={H + dimGap - tickLen}
          stroke="#555" strokeWidth={dimStroke} />
        <line x1={W - tickLen} y1={H + dimGap + tickLen} x2={W + tickLen} y2={H + dimGap - tickLen}
          stroke="#555" strokeWidth={dimStroke} />
        <text x={W / 2} y={H + textGap + fontSize * 0.35} textAnchor="middle"
          fontSize={fontSize} fontWeight="bold" fill="#2d2d2d" fontFamily="sans-serif">
          {W}
        </text>
      </g>

      <g data-testid="dimension-height">
        <line x1={-2} y1={0} x2={-dimGap - tickLen} y2={0} stroke="#555" strokeWidth={extStroke} />
        <line x1={-2} y1={H} x2={-dimGap - tickLen} y2={H} stroke="#555" strokeWidth={extStroke} />
        <line x1={-dimGap} y1={0} x2={-dimGap} y2={H} stroke="#555" strokeWidth={dimStroke} />
        <line x1={-dimGap - tickLen} y1={tickLen} x2={-dimGap + tickLen} y2={-tickLen}
          stroke="#555" strokeWidth={dimStroke} />
        <line x1={-dimGap - tickLen} y1={H + tickLen} x2={-dimGap + tickLen} y2={H - tickLen}
          stroke="#555" strokeWidth={dimStroke} />
        <text x={-textGap} y={H / 2} textAnchor="middle"
          fontSize={fontSize} fontWeight="bold" fill="#2d2d2d" fontFamily="sans-serif"
          transform={`rotate(-90, ${-textGap}, ${H / 2})`}>
          {H}
        </text>
      </g>

      <text x={W} y={-padTop * 0.35} textAnchor="end"
        fontSize={fontSize * 0.7} fill="#888" fontFamily="sans-serif">
        {frameSize}mm frame
      </text>
    </svg>
  );
}
