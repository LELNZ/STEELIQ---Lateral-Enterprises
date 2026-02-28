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
  slideDirection?: string;
  strokeScale: number;
}

function Pane({ x, y, w, h, frameSize, type, hingeSide = "left", halfSolid = false, openDirection = "out", foldDirection = "right", slideDirection = "right", strokeScale: ss }: PaneProps) {
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
        const goRight = slideDirection !== "left";
        const tipX = goRight ? midX + arrowLen : midX - arrowLen;
        const baseX = goRight ? tipX - headSize * 2 : tipX + headSize * 2;
        return (
          <g>
            <line x1={midX - arrowLen} y1={midY} x2={midX + arrowLen} y2={midY}
              stroke="#2d2d2d" strokeWidth={1.5 * ss} />
            <polyline
              points={`${baseX},${midY - headSize} ${tipX},${midY} ${baseX},${midY + headSize}`}
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

function distributeSpaces(total: number, specs: number[]): number[] {
  const specifiedSum = specs.reduce((s, v) => s + (v > 0 ? v : 0), 0);
  const autoCount = specs.filter(v => v <= 0).length;

  if (autoCount === specs.length) {
    return specs.map(() => total / specs.length);
  }

  if (autoCount === 0) {
    if (specifiedSum === 0) return specs.map(() => total / specs.length);
    return specs.map(v => (v / specifiedSum) * total);
  }

  const cappedSum = Math.min(specifiedSum, total);
  const remaining = total - cappedSum;
  const autoSize = autoCount > 0 ? remaining / autoCount : 0;

  return specs.map(v => {
    if (v <= 0) return autoSize;
    return (v / specifiedSum) * cappedSum;
  });
}

export interface GridMetrics {
  colWidths: number[];
  colMmWidths: number[];
  colRowHeights: number[][];
  colRowMmHeights: number[][];
}

function distributeMmLabels(total: number, specs: number[]): number[] {
  const distributed = distributeSpaces(total, specs);
  const raw = distributed.map(v => Math.round(v));
  const diff = total - raw.reduce((s, v) => s + v, 0);
  if (diff !== 0 && raw.length > 0) {
    raw[raw.length - 1] += diff;
  }
  return raw;
}

function computeGridMetrics(
  W: number, H: number, customColumns: CustomColumn[]
): GridMetrics {
  const widthSpecs = customColumns.map(c => c.width || 0);
  const colWidths = distributeSpaces(W, widthSpecs);
  const colMmWidths = distributeMmLabels(W, widthSpecs);

  const colRowHeights: number[][] = [];
  const colRowMmHeights: number[][] = [];

  for (let ci = 0; ci < customColumns.length; ci++) {
    const colRows = customColumns[ci].rows || [{ height: 0, type: "fixed" as const }];
    const heightSpecs = colRows.map(r => r.height || 0);
    colRowHeights.push(distributeSpaces(H, heightSpecs));
    colRowMmHeights.push(distributeMmLabels(H, heightSpecs));
  }

  return { colWidths, colMmWidths, colRowHeights, colRowMmHeights };
}

function renderCustomGrid(
  W: number, H: number, customColumns: CustomColumn[],
  frameSize: number, openDir: string, ss: number
) {
  if (!customColumns || customColumns.length === 0) {
    return <Pane x={0} y={0} w={W} h={H} frameSize={frameSize} type="fixed" strokeScale={ss} />;
  }

  const { colWidths, colRowHeights } = computeGridMetrics(W, H, customColumns);

  const elements: JSX.Element[] = [];
  let xOffset = 0;

  for (let ci = 0; ci < customColumns.length; ci++) {
    const col = customColumns[ci];
    const colW = colWidths[ci];
    const colRows = col.rows || [{ height: 0, type: "fixed" as const }];
    const rowHeights = colRowHeights[ci];

    let yOffset = 0;
    for (let ri = 0; ri < colRows.length; ri++) {
      const row = colRows[ri];
      const rowH = rowHeights[ri];
      const pType = (row.type || "fixed") as PaneProps["type"];
      elements.push(
        <Pane key={`${ci}-${ri}`}
          x={xOffset} y={yOffset} w={colW} h={rowH}
          frameSize={frameSize} type={pType}
          openDirection={openDir}
          slideDirection={(row as any).slideDirection || "right"}
          strokeScale={ss} />
      );
      yOffset += rowH;
    }
    xOffset += colW;
  }

  return <g>{elements}</g>;
}

export interface EntranceDoorMetrics {
  doorW: number;
  slW: number;
  doorMmW: number;
  slMmW: number;
  splitHeights: number[] | null;
  splitMmHeights: number[] | null;
}

function computeEntranceDoorMetrics(config: InsertQuoteItem, frameSize: number): EntranceDoorMetrics {
  const { width: W, height: H, sidelightWidth, doorSplit, doorSplitHeight } = config;
  const minPane = frameSize * 2;
  const rawSl = sidelightWidth > 0 ? sidelightWidth : 400;
  const maxSl = Math.max(minPane, W - minPane);
  const slW = clamp(rawSl, minPane, maxSl);
  const doorW = Math.max(minPane, W - slW);
  const slMmW = Math.round(slW);
  const doorMmW = W - slMmW;

  let splitHeights: number[] | null = null;
  let splitMmHeights: number[] | null = null;
  if (doorSplit) {
    const splitSpecs = [doorSplitHeight || 0, 0];
    splitHeights = distributeSpaces(H, splitSpecs);
    splitMmHeights = distributeMmLabels(H, splitSpecs);
  }

  return { doorW, slW, doorMmW, slMmW, splitHeights, splitMmHeights };
}

function renderDrawing(config: InsertQuoteItem, frameSize: number, ss: number) {
  const {
    width: W, height: H, category, layout, hingeSide, halfSolid,
    openDirection, panels, sidelightWidth, sidelightSide, doorSplit, doorSplitHeight,
    bifoldLeftCount, centerWidth, windowType, customColumns
  } = config;
  const minPane = frameSize * 2;
  const od = openDirection || "out";

  if (layout === "custom" && category !== "entrance-door") {
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
    const metrics = computeEntranceDoorMetrics(config, frameSize);
    const { doorW, slW, splitHeights } = metrics;
    const slSide = sidelightSide || "right";
    const doorX = slSide === "left" ? slW : 0;
    const slX = slSide === "left" ? 0 : doorW;

    const doorElements: JSX.Element[] = [];
    if (doorSplit && splitHeights) {
      doorElements.push(
        <Pane key="door-top" x={doorX} y={0} w={doorW} h={splitHeights[0]}
          frameSize={frameSize} type="hinge" hingeSide={hingeSide}
          openDirection={od} strokeScale={ss} />
      );
      doorElements.push(
        <Pane key="door-bottom" x={doorX} y={splitHeights[0]} w={doorW} h={splitHeights[1]}
          frameSize={frameSize} type="fixed" halfSolid={halfSolid}
          strokeScale={ss} />
      );
    } else {
      doorElements.push(
        <Pane key="door" x={doorX} y={0} w={doorW} h={H}
          frameSize={frameSize} type="hinge" hingeSide={hingeSide}
          halfSolid={halfSolid} openDirection={od} strokeScale={ss} />
      );
    }

    return (
      <g>
        {doorElements}
        <Pane key="sidelight" x={slX} y={0} w={slW} h={H}
          frameSize={frameSize} type="fixed" strokeScale={ss} />
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
  const { width: W, height: H, name, quantity, category, layout, customColumns } = config;
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

  const isCustom = layout === "custom" && category !== "entrance-door" && customColumns && customColumns.length > 0;
  const hasMultipleSections = isCustom && (
    customColumns!.length > 1 ||
    customColumns!.some(c => (c.rows || []).length > 1)
  );

  let gridMetrics: GridMetrics | null = null;
  if (isCustom) {
    gridMetrics = computeGridMetrics(W, H, customColumns!);
  }

  const isEntrance = category === "entrance-door";
  let entranceMetrics: EntranceDoorMetrics | null = null;
  if (isEntrance) {
    entranceMetrics = computeEntranceDoorMetrics(config, frameSize);
  }

  const sectionFontSize = fontSize * 0.75;
  const sectionDimGap = dimGap * 0.55;
  const sectionTextGap = dimGap * 0.9;
  const sectionTickLen = tickLen * 0.8;
  const sectionDimStroke = dimStroke * 0.7;
  const sectionExtStroke = extStroke * 0.7;

  const anyColHasMultipleRows = isCustom && customColumns!.some(c => (c.rows || []).length > 1);

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

      {hasMultipleSections && gridMetrics && gridMetrics.colWidths.length > 1 && (
        <g data-testid="dimension-section-widths">
          {(() => {
            const secY = H + dimGap + textGap * 0.6;
            const elements: JSX.Element[] = [];
            let xPos = 0;
            for (let ci = 0; ci < gridMetrics.colWidths.length; ci++) {
              const cw = gridMetrics.colWidths[ci];
              const mmW = gridMetrics.colMmWidths[ci];
              const x1 = xPos;
              const x2 = xPos + cw;
              elements.push(
                <g key={`sw-${ci}`}>
                  <line x1={x1} y1={secY - sectionTickLen} x2={x1} y2={secY + sectionTickLen}
                    stroke="#888" strokeWidth={sectionExtStroke} />
                  <line x1={x2} y1={secY - sectionTickLen} x2={x2} y2={secY + sectionTickLen}
                    stroke="#888" strokeWidth={sectionExtStroke} />
                  <line x1={x1} y1={secY} x2={x2} y2={secY}
                    stroke="#888" strokeWidth={sectionDimStroke} />
                  <line x1={x1 - sectionTickLen} y1={secY + sectionTickLen}
                    x2={x1 + sectionTickLen} y2={secY - sectionTickLen}
                    stroke="#888" strokeWidth={sectionDimStroke} />
                  <line x1={x2 - sectionTickLen} y1={secY + sectionTickLen}
                    x2={x2 + sectionTickLen} y2={secY - sectionTickLen}
                    stroke="#888" strokeWidth={sectionDimStroke} />
                  <text x={(x1 + x2) / 2} y={secY + sectionTextGap * 0.5}
                    textAnchor="middle" fontSize={sectionFontSize}
                    fontWeight="500" fill="#666" fontFamily="sans-serif">
                    {mmW}
                  </text>
                </g>
              );
              xPos += cw;
            }
            return elements;
          })()}
        </g>
      )}

      {anyColHasMultipleRows && gridMetrics && (
        <g data-testid="dimension-section-heights">
          {(() => {
            const elements: JSX.Element[] = [];
            let xPos = 0;
            for (let ci = 0; ci < gridMetrics.colWidths.length; ci++) {
              const colW = gridMetrics.colWidths[ci];
              const rowHeights = gridMetrics.colRowHeights[ci];
              const mmHeights = gridMetrics.colRowMmHeights[ci];
              if (rowHeights.length <= 1) {
                xPos += colW;
                continue;
              }
              const secX = xPos + colW / 2;
              let yPos = 0;
              for (let ri = 0; ri < rowHeights.length; ri++) {
                const rh = rowHeights[ri];
                const mmH = mmHeights[ri];
                const y1 = yPos;
                const y2 = yPos + rh;
                const midY = (y1 + y2) / 2;
                elements.push(
                  <g key={`sh-${ci}-${ri}`}>
                    <text x={secX} y={midY + sectionFontSize * 0.35}
                      textAnchor="middle" fontSize={sectionFontSize}
                      fontWeight="500" fill="#666" fontFamily="sans-serif"
                      opacity={0.8}>
                      {mmH}
                    </text>
                  </g>
                );
                yPos += rh;
              }
              xPos += colW;
            }
            return elements;
          })()}
        </g>
      )}

      {isEntrance && entranceMetrics && (
        <g data-testid="dimension-entrance-sections">
          {(() => {
            const { doorW, slW, doorMmW, slMmW, splitHeights, splitMmHeights } = entranceMetrics;
            const slSide = config.sidelightSide || "right";
            const secY = H + dimGap + textGap * 0.6;
            const elements: JSX.Element[] = [];

            const sections = slSide === "left"
              ? [{ w: slW, mm: slMmW }, { w: doorW, mm: doorMmW }]
              : [{ w: doorW, mm: doorMmW }, { w: slW, mm: slMmW }];

            let xPos = 0;
            sections.forEach((sec, i) => {
              const x1 = xPos;
              const x2 = xPos + sec.w;
              elements.push(
                <g key={`ew-${i}`}>
                  <line x1={x1} y1={secY - sectionTickLen} x2={x1} y2={secY + sectionTickLen}
                    stroke="#888" strokeWidth={sectionExtStroke} />
                  <line x1={x2} y1={secY - sectionTickLen} x2={x2} y2={secY + sectionTickLen}
                    stroke="#888" strokeWidth={sectionExtStroke} />
                  <line x1={x1} y1={secY} x2={x2} y2={secY}
                    stroke="#888" strokeWidth={sectionDimStroke} />
                  <line x1={x1 - sectionTickLen} y1={secY + sectionTickLen}
                    x2={x1 + sectionTickLen} y2={secY - sectionTickLen}
                    stroke="#888" strokeWidth={sectionDimStroke} />
                  <line x1={x2 - sectionTickLen} y1={secY + sectionTickLen}
                    x2={x2 + sectionTickLen} y2={secY - sectionTickLen}
                    stroke="#888" strokeWidth={sectionDimStroke} />
                  <text x={(x1 + x2) / 2} y={secY + sectionTextGap * 0.5}
                    textAnchor="middle" fontSize={sectionFontSize}
                    fontWeight="500" fill="#666" fontFamily="sans-serif">
                    {sec.mm}
                  </text>
                </g>
              );
              xPos += sec.w;
            });

            if (splitHeights && splitMmHeights) {
              const doorX = slSide === "left" ? slW : 0;
              const dimX = doorX + doorW + sectionDimGap;
              let yPos = 0;
              for (let ri = 0; ri < splitHeights.length; ri++) {
                const rh = splitHeights[ri];
                const mmH = splitMmHeights[ri];
                const y1 = yPos;
                const y2 = yPos + rh;
                const midY = (y1 + y2) / 2;
                elements.push(
                  <g key={`eh-${ri}`}>
                    <line x1={doorX + doorW + 2} y1={y1} x2={dimX + sectionTickLen} y2={y1}
                      stroke="#888" strokeWidth={sectionExtStroke} />
                    <line x1={doorX + doorW + 2} y1={y2} x2={dimX + sectionTickLen} y2={y2}
                      stroke="#888" strokeWidth={sectionExtStroke} />
                    <line x1={dimX} y1={y1} x2={dimX} y2={y2}
                      stroke="#888" strokeWidth={sectionDimStroke} />
                    <line x1={dimX - sectionTickLen} y1={y1 + sectionTickLen}
                      x2={dimX + sectionTickLen} y2={y1 - sectionTickLen}
                      stroke="#888" strokeWidth={sectionDimStroke} />
                    <line x1={dimX - sectionTickLen} y1={y2 + sectionTickLen}
                      x2={dimX + sectionTickLen} y2={y2 - sectionTickLen}
                      stroke="#888" strokeWidth={sectionDimStroke} />
                    <text x={dimX + sectionTextGap * 0.5} y={midY + sectionFontSize * 0.35}
                      textAnchor="start" fontSize={sectionFontSize}
                      fontWeight="500" fill="#666" fontFamily="sans-serif">
                      {mmH}
                    </text>
                  </g>
                );
                yPos += rh;
              }
            }

            return elements;
          })()}
        </g>
      )}

      <text x={W} y={-padTop * 0.35} textAnchor="end"
        fontSize={fontSize * 0.7} fill="#888" fontFamily="sans-serif">
        {frameSize}mm frame
      </text>
    </svg>
  );
}
