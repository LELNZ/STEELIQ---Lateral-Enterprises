import { forwardRef } from "react";
import type { InsertQuoteItem, CustomColumn, EntranceDoorRow } from "@shared/schema";

const DEFAULT_DOOR_ROW: EntranceDoorRow = { height: 0, type: "fixed", slideDirection: "right" };

const FRAME_WIN = 52;
const FRAME_SLIDE = 127;
const FRAME_BIFOLD = 70;

export function getFrameSize(category: string): number {
  if (category === "sliding-window" || category === "sliding-door" || category === "stacker-door") return FRAME_SLIDE;
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
  const hingeDashed = openDirection === "in";
  const hingeDash = hingeDashed ? `${14 * ss} ${6 * ss}` : "none";
  const hingeStroke = hingeDashed ? 1.5 * ss : 1 * ss;

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
            fill="none" stroke="#2d2d2d" strokeWidth={1 * ss} />
          <line
            x1={midX - Math.min(gw * 0.08, 20)} y1={gy + gh - inset * 0.3}
            x2={midX + Math.min(gw * 0.08, 20)} y2={gy + gh - inset * 0.3}
            stroke="#2d2d2d" strokeWidth={2.5 * ss} strokeLinecap="round" />
        </>
      )}

      {type === "hinge" && hingeSide === "left" && (
        <polyline
          points={`${gx + gw},${gy} ${gx},${midY} ${gx + gw},${gy + gh}`}
          fill="none" stroke="#2d2d2d" strokeWidth={hingeStroke}
          strokeDasharray={hingeDash} />
      )}

      {type === "hinge" && hingeSide === "right" && (
        <polyline
          points={`${gx},${gy} ${gx + gw},${midY} ${gx},${gy + gh}`}
          fill="none" stroke="#2d2d2d" strokeWidth={hingeStroke}
          strokeDasharray={hingeDash} />
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
  colEffectiveHeights: number[];
  colMmHeights: number[];
  maxColHeight: number;
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

  const colEffectiveHeights: number[] = customColumns.map(c => (c.heightOverride && c.heightOverride > 0) ? Math.min(c.heightOverride, H) : H);
  const colMmHeights: number[] = colEffectiveHeights.map(h => Math.round(h));
  const maxColHeight = H;

  const colRowHeights: number[][] = [];
  const colRowMmHeights: number[][] = [];

  for (let ci = 0; ci < customColumns.length; ci++) {
    const colRows = customColumns[ci].rows || [{ height: 0, type: "fixed" as const }];
    const heightSpecs = colRows.map(r => r.height || 0);
    const colH = colEffectiveHeights[ci];
    colRowHeights.push(distributeSpaces(colH, heightSpecs));
    colRowMmHeights.push(distributeMmLabels(colH, heightSpecs));
  }

  return { colWidths, colMmWidths, colRowHeights, colRowMmHeights, colEffectiveHeights, colMmHeights, maxColHeight };
}

function renderCustomGrid(
  W: number, H: number, customColumns: CustomColumn[],
  frameSize: number, openDir: string, ss: number
) {
  if (!customColumns || customColumns.length === 0) {
    return <Pane x={0} y={0} w={W} h={H} frameSize={frameSize} type="fixed" strokeScale={ss} />;
  }

  const metrics = computeGridMetrics(W, H, customColumns);
  const { colWidths, colRowHeights, colEffectiveHeights } = metrics;

  const elements: JSX.Element[] = [];
  let xOffset = 0;

  for (let ci = 0; ci < customColumns.length; ci++) {
    const col = customColumns[ci];
    const colW = colWidths[ci];
    const colRows = col.rows || [{ height: 0, type: "fixed" as const }];
    const rowHeights = colRowHeights[ci];
    const colH = colEffectiveHeights[ci];
    const yStart = H - colH;

    let yOffset = yStart;
    for (let ri = 0; ri < colRows.length; ri++) {
      const row = colRows[ri];
      const rowH = rowHeights[ri];
      const pType = (row.type || "fixed") as PaneProps["type"];
      elements.push(
        <Pane key={`${ci}-${ri}`}
          x={xOffset} y={yOffset} w={colW} h={rowH}
          frameSize={frameSize} type={pType}
          hingeSide={row.hingeSide || "left"}
          openDirection={pType === "hinge" ? (row.openDirection || "out") : openDir}
          slideDirection={row.slideDirection || "right"}
          strokeScale={ss} />
      );
      yOffset += rowH;
    }
    xOffset += colW;
  }

  return <g>{elements}</g>;
}

export interface EntranceDoorMetrics {
  sections: { x: number; w: number; mmW: number; role: "door" | "sidelight-left" | "sidelight-right" | "sidelight" }[];
  doorRowHeights: number[];
  doorRowMmHeights: number[];
  slRowHeights: number[];
  slRowMmHeights: number[];
  slLeftRowHeights: number[];
  slLeftRowMmHeights: number[];
}

function computeEntranceDoorMetrics(config: InsertQuoteItem, frameSize: number): EntranceDoorMetrics {
  const { width: W, height: H, sidelightWidth, sidelightEnabled, sidelightSide } = config;
  const minPane = frameSize * 2;
  const rawSl = sidelightWidth > 0 ? sidelightWidth : 400;
  const doorRows: EntranceDoorRow[] = config.entranceDoorRows || [{ ...DEFAULT_DOOR_ROW }];
  const slRows: EntranceDoorRow[] = config.entranceSidelightRows || [{ ...DEFAULT_DOOR_ROW }];
  const slLeftRows: EntranceDoorRow[] = config.entranceSidelightLeftRows || [{ ...DEFAULT_DOOR_ROW }];

  const doorRowHeights = distributeSpaces(H, doorRows.map(r => r.height || 0));
  const doorRowMmHeights = distributeMmLabels(H, doorRows.map(r => r.height || 0));
  const slRowHeights = distributeSpaces(H, slRows.map(r => r.height || 0));
  const slRowMmHeights = distributeMmLabels(H, slRows.map(r => r.height || 0));
  const slLeftRowHeights = distributeSpaces(H, slLeftRows.map(r => r.height || 0));
  const slLeftRowMmHeights = distributeMmLabels(H, slLeftRows.map(r => r.height || 0));

  type SectionInfo = EntranceDoorMetrics["sections"][0];
  const sections: SectionInfo[] = [];

  if (!sidelightEnabled) {
    sections.push({ x: 0, w: W, mmW: W, role: "door" });
  } else if (sidelightSide === "both") {
    const slEachW = clamp(rawSl, minPane, Math.max(minPane, (W - minPane) / 2));
    const doorW = Math.max(minPane, W - slEachW * 2);
    const slMmW = Math.round(slEachW);
    const doorMmW = W - slMmW * 2;
    sections.push({ x: 0, w: slEachW, mmW: slMmW, role: "sidelight-left" });
    sections.push({ x: slEachW, w: doorW, mmW: doorMmW, role: "door" });
    sections.push({ x: slEachW + doorW, w: slEachW, mmW: slMmW, role: "sidelight-right" });
  } else {
    const maxSl = Math.max(minPane, W - minPane);
    const slW = clamp(rawSl, minPane, maxSl);
    const doorW = Math.max(minPane, W - slW);
    const slMmW = Math.round(slW);
    const doorMmW = W - slMmW;
    if (sidelightSide === "left") {
      sections.push({ x: 0, w: slW, mmW: slMmW, role: "sidelight" });
      sections.push({ x: slW, w: doorW, mmW: doorMmW, role: "door" });
    } else {
      sections.push({ x: 0, w: doorW, mmW: doorMmW, role: "door" });
      sections.push({ x: doorW, w: slW, mmW: slMmW, role: "sidelight" });
    }
  }

  return { sections, doorRowHeights, doorRowMmHeights, slRowHeights, slRowMmHeights, slLeftRowHeights, slLeftRowMmHeights };
}

function renderDrawing(config: InsertQuoteItem, frameSize: number, ss: number) {
  const {
    width: W, height: H, category, layout, hingeSide,
    openDirection, panels, sidelightWidth, sidelightSide, doorSplit, doorSplitHeight,
    bifoldLeftCount, centerWidth, windowType, customColumns
  } = config;
  const minPane = frameSize * 2;
  const od = openDirection || "out";

  const noCustomCats = ["entrance-door", "hinge-door", "french-door", "bifold-door", "stacker-door"];
  if (layout === "custom" && !noCustomCats.includes(category)) {
    return renderCustomGrid(W, H, customColumns || [], frameSize, od, ss);
  }

  if (layout === "custom" && category === "hinge-door") {
    const grid = renderCustomGrid(W, H, customColumns || [], frameSize, od, ss);
    const inset = frameSize * 0.7;
    const gx = inset;
    const gy = inset;
    const gw = W - inset * 2;
    const gh = H - inset * 2;
    const isDashed = od === "in";
    const dash = isDashed ? `${14 * ss} ${6 * ss}` : "none";
    const triStroke = isDashed ? 1.5 * ss : 1 * ss;
    const midY = gy + gh / 2;
    const triPoints = hingeSide === "left"
      ? `${gx + gw},${gy} ${gx},${midY} ${gx + gw},${gy + gh}`
      : `${gx},${gy} ${gx + gw},${midY} ${gx},${gy + gh}`;
    return (
      <g>
        {grid}
        {gw > 0 && gh > 0 && (
          <polyline points={triPoints}
            fill="none" stroke="#2d2d2d" strokeWidth={triStroke}
            strokeDasharray={dash} />
        )}
      </g>
    );
  }

  if (category === "windows-standard") {
    if (windowType === "french-left") {
      return <Pane x={0} y={0} w={W} h={H} frameSize={frameSize}
        type="hinge" hingeSide="left" openDirection="out" strokeScale={ss} />;
    }
    if (windowType === "french-right") {
      return <Pane x={0} y={0} w={W} h={H} frameSize={frameSize}
        type="hinge" hingeSide="right" openDirection="out" strokeScale={ss} />;
    }
    if (windowType === "french-pair") {
      const halfW = W / 2;
      return (
        <g>
          <Pane x={0} y={0} w={halfW} h={H} frameSize={frameSize}
            type="hinge" hingeSide="left" openDirection="out" strokeScale={ss} />
          <Pane x={halfW} y={0} w={halfW} h={H} frameSize={frameSize}
            type="hinge" hingeSide="right" openDirection="out" strokeScale={ss} />
        </g>
      );
    }
    const wt = windowType === "awning" ? "awning" : "fixed";
    return <Pane x={0} y={0} w={W} h={H} frameSize={frameSize}
      type={wt} openDirection="out" strokeScale={ss} />;
  }

  if (category === "sliding-window" || category === "sliding-door") {
    return (
      <g>
        <Pane x={0} y={0} w={W / 2} h={H} frameSize={frameSize} type="fixed" strokeScale={ss} />
        <Pane x={W / 2} y={0} w={W / 2} h={H} frameSize={frameSize} type="sliding" strokeScale={ss} />
      </g>
    );
  }

  if (category === "entrance-door") {
    const metrics = computeEntranceDoorMetrics(config, frameSize);
    const { sections, doorRowHeights, slRowHeights, slLeftRowHeights } = metrics;
    const doorRows: import("@shared/schema").EntranceDoorRow[] = config.entranceDoorRows || [{ ...DEFAULT_DOOR_ROW }];
    const slRows: import("@shared/schema").EntranceDoorRow[] = config.entranceSidelightRows || [{ ...DEFAULT_DOOR_ROW }];
    const slLeftRowsDef: import("@shared/schema").EntranceDoorRow[] = config.entranceSidelightLeftRows || [{ ...DEFAULT_DOOR_ROW }];
    const elements: JSX.Element[] = [];

    for (const sec of sections) {
      if (sec.role === "door") {
        let yOff = 0;
        for (let ri = 0; ri < doorRows.length; ri++) {
          const rh = doorRowHeights[ri];
          const pType = doorRows[ri].type === "awning" ? "awning" as const : "fixed" as const;
          elements.push(
            <Pane key={`door-${ri}`} x={sec.x} y={yOff} w={sec.w} h={rh}
              frameSize={frameSize} type={pType} openDirection={od} strokeScale={ss} />
          );
          yOff += rh;
        }
        const inset = frameSize * 0.7;
        const gx = sec.x + inset;
        const gy = inset;
        const gw = sec.w - inset * 2;
        const gh = H - inset * 2;
        if (gw > 0 && gh > 0) {
          const isDashed = od === "in";
          const dash = isDashed ? `${14 * ss} ${6 * ss}` : "none";
          const triStroke = isDashed ? 1.5 * ss : 1 * ss;
          const midY = gy + gh / 2;
          if (hingeSide === "left") {
            elements.push(
              <polyline key="hinge-tri"
                points={`${gx + gw},${gy} ${gx},${midY} ${gx + gw},${gy + gh}`}
                fill="none" stroke="#2d2d2d" strokeWidth={triStroke}
                strokeDasharray={dash} />
            );
          } else {
            elements.push(
              <polyline key="hinge-tri"
                points={`${gx},${gy} ${gx + gw},${midY} ${gx},${gy + gh}`}
                fill="none" stroke="#2d2d2d" strokeWidth={triStroke}
                strokeDasharray={dash} />
            );
          }
        }
      } else {
        const isSidelightLeft = sec.role === "sidelight-left";
        const rowDefs = isSidelightLeft ? slLeftRowsDef : slRows;
        const rowH = isSidelightLeft ? slLeftRowHeights : slRowHeights;
        let yOff = 0;
        for (let ri = 0; ri < rowDefs.length; ri++) {
          const rh = rowH[ri];
          const pType = rowDefs[ri].type === "awning" ? "awning" as const : "fixed" as const;
          elements.push(
            <Pane key={`${sec.role}-${ri}`} x={sec.x} y={yOff} w={sec.w} h={rh}
              frameSize={frameSize} type={pType} openDirection={od} strokeScale={ss} />
          );
          yOff += rh;
        }
      }
    }

    return <g>{elements}</g>;
  }

  if (category === "hinge-door") {
    const hdRows: EntranceDoorRow[] = config.hingeDoorRows || [{ ...DEFAULT_DOOR_ROW }];
    const rowHeights = distributeSpaces(H, hdRows.map(r => r.height || 0));
    const elements: JSX.Element[] = [];
    let yOff = 0;
    for (let ri = 0; ri < hdRows.length; ri++) {
      const rh = rowHeights[ri];
      const pType = hdRows[ri].type === "awning" ? "awning" as const : "fixed" as const;
      elements.push(
        <Pane key={`hd-${ri}`} x={0} y={yOff} w={W} h={rh}
          frameSize={frameSize} type={pType} openDirection={od} strokeScale={ss} />
      );
      yOff += rh;
    }
    const inset = frameSize * 0.7;
    const gx = inset;
    const gy = inset;
    const gw = W - inset * 2;
    const gh = H - inset * 2;
    if (gw > 0 && gh > 0) {
      const isDashed = od === "in";
      const dash = isDashed ? `${14 * ss} ${6 * ss}` : "none";
      const triStroke = isDashed ? 1.5 * ss : 1 * ss;
      const midY = gy + gh / 2;
      if (hingeSide === "left") {
        elements.push(
          <polyline key="hinge-tri"
            points={`${gx + gw},${gy} ${gx},${midY} ${gx + gw},${gy + gh}`}
            fill="none" stroke="#2d2d2d" strokeWidth={triStroke}
            strokeDasharray={dash} />
        );
      } else {
        elements.push(
          <polyline key="hinge-tri"
            points={`${gx},${gy} ${gx + gw},${midY} ${gx},${gy + gh}`}
            fill="none" stroke="#2d2d2d" strokeWidth={triStroke}
            strokeDasharray={dash} />
        );
      }
    }
    return <g>{elements}</g>;
  }

  if (category === "french-door") {
    const leftRows: EntranceDoorRow[] = config.frenchDoorLeftRows || [{ ...DEFAULT_DOOR_ROW }];
    const rightRows: EntranceDoorRow[] = config.frenchDoorRightRows || [{ ...DEFAULT_DOOR_ROW }];
    const halfW = W / 2;
    const leftRowHeights = distributeSpaces(H, leftRows.map(r => r.height || 0));
    const rightRowHeights = distributeSpaces(H, rightRows.map(r => r.height || 0));
    const elements: JSX.Element[] = [];

    let yOff = 0;
    for (let ri = 0; ri < leftRows.length; ri++) {
      const rh = leftRowHeights[ri];
      const pType = leftRows[ri].type === "awning" ? "awning" as const : "fixed" as const;
      elements.push(
        <Pane key={`fl-${ri}`} x={0} y={yOff} w={halfW} h={rh}
          frameSize={frameSize} type={pType} openDirection={od} strokeScale={ss} />
      );
      yOff += rh;
    }

    yOff = 0;
    for (let ri = 0; ri < rightRows.length; ri++) {
      const rh = rightRowHeights[ri];
      const pType = rightRows[ri].type === "awning" ? "awning" as const : "fixed" as const;
      elements.push(
        <Pane key={`fr-${ri}`} x={halfW} y={yOff} w={halfW} h={rh}
          frameSize={frameSize} type={pType} openDirection={od} strokeScale={ss} />
      );
      yOff += rh;
    }

    const inset = frameSize * 0.7;
    const isDashed = od === "in";
    const dash = isDashed ? `${14 * ss} ${6 * ss}` : "none";
    const triStroke = isDashed ? 1.5 * ss : 1 * ss;

    const lgx = inset;
    const lgy = inset;
    const lgw = halfW - inset * 2;
    const lgh = H - inset * 2;
    if (lgw > 0 && lgh > 0) {
      const midY = lgy + lgh / 2;
      elements.push(
        <polyline key="hinge-left"
          points={`${lgx + lgw},${lgy} ${lgx},${midY} ${lgx + lgw},${lgy + lgh}`}
          fill="none" stroke="#2d2d2d" strokeWidth={triStroke}
          strokeDasharray={dash} />
      );
    }

    const rgx = halfW + inset;
    const rgy = inset;
    const rgw = halfW - inset * 2;
    const rgh = H - inset * 2;
    if (rgw > 0 && rgh > 0) {
      const midY = rgy + rgh / 2;
      elements.push(
        <polyline key="hinge-right"
          points={`${rgx},${rgy} ${rgx + rgw},${midY} ${rgx},${rgy + rgh}`}
          fill="none" stroke="#2d2d2d" strokeWidth={triStroke}
          strokeDasharray={dash} />
      );
    }

    return <g>{elements}</g>;
  }

  if (category === "bifold-door") {
    const leafCount = panels || 3;
    const leftCount = bifoldLeftCount ?? Math.floor(leafCount / 2);
    const lw = W / leafCount;
    const pRows: EntranceDoorRow[][] = config.panelRows || [];
    const elements: JSX.Element[] = [];

    for (let i = 0; i < leafCount; i++) {
      const leafRows = pRows[i] || [{ ...DEFAULT_DOOR_ROW }];
      const rowHeights = distributeSpaces(H, leafRows.map(r => r.height || 0));
      const px = i * lw;

      let yOff = 0;
      for (let ri = 0; ri < leafRows.length; ri++) {
        const rh = rowHeights[ri];
        const pType = leafRows[ri].type === "awning" ? "awning" as const : "fixed" as const;
        elements.push(
          <Pane key={`bf-${i}-${ri}`} x={px} y={yOff} w={lw} h={rh}
            frameSize={frameSize} type={pType} openDirection={od} strokeScale={ss} />
        );
        yOff += rh;
      }

      const inset = frameSize * 0.7;
      const gx = px + inset;
      const gy = inset;
      const gw = lw - inset * 2;
      const gh = H - inset * 2;
      if (gw > 0 && gh > 0) {
        const midX = px + lw / 2;
        const midY = gy + gh / 2;
        const cw = gw * 0.15;
        const ch = gh * 0.18;
        const foldDir = i < leftCount ? "left" : "right";
        if (foldDir === "left") {
          elements.push(
            <polyline key={`bfc-${i}`}
              points={`${midX + cw},${midY - ch} ${midX - cw},${midY} ${midX + cw},${midY + ch}`}
              fill="none" stroke="#2d2d2d" strokeWidth={1.2 * ss} />
          );
        } else {
          elements.push(
            <polyline key={`bfc-${i}`}
              points={`${midX - cw},${midY - ch} ${midX + cw},${midY} ${midX - cw},${midY + ch}`}
              fill="none" stroke="#2d2d2d" strokeWidth={1.2 * ss} />
          );
        }
      }
    }

    return <g>{elements}</g>;
  }

  if (category === "stacker-door") {
    const panelCount = panels || 3;
    const pw = W / panelCount;
    const pRows: EntranceDoorRow[][] = config.panelRows || [];
    const elements: JSX.Element[] = [];

    const STACKER_DEFAULT_ROW: EntranceDoorRow = { height: 0, type: "sliding", slideDirection: "right" };
    for (let i = 0; i < panelCount; i++) {
      const panelRowDefs = pRows[i] || [{ ...STACKER_DEFAULT_ROW }];
      const rowHeights = distributeSpaces(H, panelRowDefs.map(r => r.height || 0));
      const px = i * pw;

      let yOff = 0;
      let hasSlidingRow = false;
      let allFixed = true;
      for (let ri = 0; ri < panelRowDefs.length; ri++) {
        const rowDef = panelRowDefs[ri];
        const rh = rowHeights[ri];
        const pType = rowDef.type === "awning" ? "awning" as const : rowDef.type === "sliding" ? "sliding" as const : "fixed" as const;
        if (pType === "sliding") hasSlidingRow = true;
        if (pType !== "fixed") allFixed = false;
        elements.push(
          <Pane key={`st-${i}-${ri}`} x={px} y={yOff} w={pw} h={rh}
            frameSize={frameSize} type={pType} slideDirection={rowDef.slideDirection ?? "right"}
            openDirection={od} strokeScale={ss} />
        );
        yOff += rh;
      }

      if (!hasSlidingRow && !allFixed) {
        const inset = frameSize * 0.7;
        const gy = inset;
        const gw = pw - inset * 2;
        const gh = H - inset * 2;
        if (gw > 0 && gh > 0) {
          const midX = px + pw / 2;
          const midY = gy + gh / 2;
          const arrowLen = gw * 0.25;
          const headSize = Math.min(gh * 0.025, 12);
          const tipX = midX + arrowLen;
          const baseX = tipX - headSize * 2;
          elements.push(
            <g key={`sta-${i}`}>
              <line x1={midX - arrowLen} y1={midY} x2={midX + arrowLen} y2={midY}
                stroke="#2d2d2d" strokeWidth={1.5 * ss} />
              <polyline
                points={`${baseX},${midY - headSize} ${tipX},${midY} ${baseX},${midY + headSize}`}
                fill="#2d2d2d" stroke="#2d2d2d" strokeWidth={1.5 * ss} />
            </g>
          );
        }
      }
    }

    return <g>{elements}</g>;
  }

  if (category === "raked-fixed") {
    const leftH = (config as any).rakedLeftHeight || H;
    const rightH = (config as any).rakedRightHeight || H;
    const splitEnabled = (config as any).rakedSplitEnabled || false;
    const splitPos = (config as any).rakedSplitPosition || 0;
    const inset = frameSize * 0.7;

    const topLeft = { x: 0, y: H - leftH };
    const topRight = { x: W, y: H - rightH };
    const botLeft = { x: 0, y: H };
    const botRight = { x: W, y: H };

    const framePoints = `${topLeft.x},${topLeft.y} ${topRight.x},${topRight.y} ${botRight.x},${botRight.y} ${botLeft.x},${botLeft.y}`;

    const slopeAtX = (xPos: number) => {
      const t = xPos / W;
      return topLeft.y + t * (topRight.y - topLeft.y);
    };

    const glassTopLeftY = topLeft.y + inset;
    const glassTopRightY = topRight.y + inset;
    const glassBot = H - inset;
    const glassLeft = inset;
    const glassRight = W - inset;

    const glassSlopeAtX = (xPos: number) => {
      const t = (xPos - glassLeft) / (glassRight - glassLeft);
      return glassTopLeftY + t * (glassTopRightY - glassTopLeftY);
    };

    const elements: JSX.Element[] = [];

    elements.push(
      <polygon key="frame" points={framePoints}
        fill="#fafafa" stroke="#2d2d2d" strokeWidth={2.5 * ss} />
    );

    if (splitEnabled && splitPos > 0 && splitPos < W) {
      const splitTopY = slopeAtX(splitPos);
      const glassSplitLeft = Math.max(glassLeft, splitPos - inset * 0.5);
      const glassSplitRight = Math.min(glassRight, splitPos + inset * 0.5);

      const leftGlassPoints = `${glassLeft},${glassTopLeftY} ${glassSplitLeft},${glassSlopeAtX(glassSplitLeft)} ${glassSplitLeft},${glassBot} ${glassLeft},${glassBot}`;
      const rightGlassPoints = `${glassSplitRight},${glassSlopeAtX(glassSplitRight)} ${glassRight},${glassTopRightY} ${glassRight},${glassBot} ${glassSplitRight},${glassBot}`;

      elements.push(
        <polygon key="glass-left" points={leftGlassPoints}
          fill="#dce8f5" stroke="#2d2d2d" strokeWidth={1 * ss} />
      );
      elements.push(
        <polygon key="glass-right" points={rightGlassPoints}
          fill="#dce8f5" stroke="#2d2d2d" strokeWidth={1 * ss} />
      );
      elements.push(
        <line key="split-line" x1={splitPos} y1={splitTopY} x2={splitPos} y2={H}
          stroke="#2d2d2d" strokeWidth={2.5 * ss} />
      );
    } else {
      const glassPoints = `${glassLeft},${glassTopLeftY} ${glassRight},${glassTopRightY} ${glassRight},${glassBot} ${glassLeft},${glassBot}`;
      elements.push(
        <polygon key="glass" points={glassPoints}
          fill="#dce8f5" stroke="#2d2d2d" strokeWidth={1 * ss} />
      );
    }

    return <g>{elements}</g>;
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

const DrawingCanvas = forwardRef<SVGSVGElement, { config: InsertQuoteItem }>(({ config }, ref) => {
  const { width: W, height: H, name, quantity, category, layout, customColumns } = config;
  const isRaked = category === "raked-fixed";
  const rakedLeftH = isRaked ? ((config as any).rakedLeftHeight || H) : H;
  const rakedRightH = isRaked ? ((config as any).rakedRightHeight || H) : H;
  const rakedSplitEnabled = isRaked ? ((config as any).rakedSplitEnabled || false) : false;
  const rakedSplitPos = isRaked ? ((config as any).rakedSplitPosition || 0) : 0;
  const frameSize = getFrameSize(category);

  const noCustomCatsSet = ["entrance-door", "hinge-door", "french-door", "bifold-door", "stacker-door"];
  const isCustom = layout === "custom" && !noCustomCatsSet.includes(category) && customColumns && customColumns.length > 0;

  let gridMetrics: GridMetrics | null = null;
  if (isCustom) {
    gridMetrics = computeGridMetrics(W, H, customColumns!);
  }

  const hasColHeightOverrides = isCustom && customColumns!.some(c => c.heightOverride && c.heightOverride > 0 && c.heightOverride < H);

  const maxDim = Math.max(W, H);
  const ss = maxDim / 1500;

  const dimGap = maxDim * 0.06;
  const textGap = maxDim * 0.1;
  const padLeft = maxDim * 0.16;
  const padBottom = maxDim * 0.16;
  const padRight = isRaked ? maxDim * 0.16 : maxDim * 0.05;
  const padTop = maxDim * 0.1;

  const fontSize = Math.max(maxDim * 0.028, 14);
  const titleFontSize = Math.max(maxDim * 0.032, 16);
  const tickLen = maxDim * 0.012;
  const dimStroke = 1.2 * ss;
  const extStroke = 0.6 * ss;

  const hasMultipleSections = isCustom && (
    customColumns!.length > 1 ||
    customColumns!.some(c => (c.rows || []).length > 1)
  );

  const isEntrance = category === "entrance-door";
  let entranceMetrics: EntranceDoorMetrics | null = null;
  if (isEntrance) {
    entranceMetrics = computeEntranceDoorMetrics(config, frameSize);
  }

  const isHingeDoorStd = category === "hinge-door" && layout !== "custom";
  const hingeDoorRowDefs: EntranceDoorRow[] = config.hingeDoorRows || [{ ...DEFAULT_DOOR_ROW }];
  const hingeDoorRowHeights = isHingeDoorStd ? distributeSpaces(H, hingeDoorRowDefs.map(r => r.height || 0)) : [];
  const hingeDoorRowMmHeights = isHingeDoorStd ? distributeMmLabels(H, hingeDoorRowDefs.map(r => r.height || 0)) : [];

  const isFrenchDoor = category === "french-door";
  const frenchLeftRows: EntranceDoorRow[] = config.frenchDoorLeftRows || [{ ...DEFAULT_DOOR_ROW }];
  const frenchRightRows: EntranceDoorRow[] = config.frenchDoorRightRows || [{ ...DEFAULT_DOOR_ROW }];
  const frenchLeftRowHeights = isFrenchDoor ? distributeSpaces(H, frenchLeftRows.map(r => r.height || 0)) : [];
  const frenchLeftRowMmHeights = isFrenchDoor ? distributeMmLabels(H, frenchLeftRows.map(r => r.height || 0)) : [];
  const frenchRightRowHeights = isFrenchDoor ? distributeSpaces(H, frenchRightRows.map(r => r.height || 0)) : [];
  const frenchRightRowMmHeights = isFrenchDoor ? distributeMmLabels(H, frenchRightRows.map(r => r.height || 0)) : [];

  const isBifoldDoor = category === "bifold-door";
  const isStackerDoor = category === "stacker-door";
  const panelRowsDef: EntranceDoorRow[][] = config.panelRows || [];
  const panelCount = (isBifoldDoor || isStackerDoor) ? (config.panels || 3) : 0;
  const panelRowHeightsAll: number[][] = [];
  const panelRowMmHeightsAll: number[][] = [];
  if (isBifoldDoor || isStackerDoor) {
    for (let i = 0; i < panelCount; i++) {
      const pRowDefs = panelRowsDef[i] || [{ ...DEFAULT_DOOR_ROW }];
      panelRowHeightsAll.push(distributeSpaces(H, pRowDefs.map(r => r.height || 0)));
      panelRowMmHeightsAll.push(distributeMmLabels(H, pRowDefs.map(r => r.height || 0)));
    }
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
      ref={ref}
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

      {isRaked ? (
        <>
          <g data-testid="dimension-left-height">
            <line x1={-2} y1={H - rakedLeftH} x2={-dimGap - tickLen} y2={H - rakedLeftH} stroke="#555" strokeWidth={extStroke} />
            <line x1={-2} y1={H} x2={-dimGap - tickLen} y2={H} stroke="#555" strokeWidth={extStroke} />
            <line x1={-dimGap} y1={H - rakedLeftH} x2={-dimGap} y2={H} stroke="#555" strokeWidth={dimStroke} />
            <line x1={-dimGap - tickLen} y1={H - rakedLeftH + tickLen} x2={-dimGap + tickLen} y2={H - rakedLeftH - tickLen}
              stroke="#555" strokeWidth={dimStroke} />
            <line x1={-dimGap - tickLen} y1={H + tickLen} x2={-dimGap + tickLen} y2={H - tickLen}
              stroke="#555" strokeWidth={dimStroke} />
            <text x={-textGap} y={H - rakedLeftH / 2} textAnchor="middle"
              fontSize={fontSize} fontWeight="bold" fill="#2d2d2d" fontFamily="sans-serif"
              transform={`rotate(-90, ${-textGap}, ${H - rakedLeftH / 2})`}>
              {rakedLeftH}
            </text>
          </g>
          <g data-testid="dimension-right-height">
            <line x1={W + 2} y1={H - rakedRightH} x2={W + dimGap + tickLen} y2={H - rakedRightH} stroke="#555" strokeWidth={extStroke} />
            <line x1={W + 2} y1={H} x2={W + dimGap + tickLen} y2={H} stroke="#555" strokeWidth={extStroke} />
            <line x1={W + dimGap} y1={H - rakedRightH} x2={W + dimGap} y2={H} stroke="#555" strokeWidth={dimStroke} />
            <line x1={W + dimGap - tickLen} y1={H - rakedRightH + tickLen} x2={W + dimGap + tickLen} y2={H - rakedRightH - tickLen}
              stroke="#555" strokeWidth={dimStroke} />
            <line x1={W + dimGap - tickLen} y1={H + tickLen} x2={W + dimGap + tickLen} y2={H - tickLen}
              stroke="#555" strokeWidth={dimStroke} />
            <text x={W + textGap} y={H - rakedRightH / 2} textAnchor="middle"
              fontSize={fontSize} fontWeight="bold" fill="#2d2d2d" fontFamily="sans-serif"
              transform={`rotate(90, ${W + textGap}, ${H - rakedRightH / 2})`}>
              {rakedRightH}
            </text>
          </g>
          {rakedSplitEnabled && rakedSplitPos > 0 && rakedSplitPos < W && (
            <g data-testid="dimension-raked-split">
              {(() => {
                const secY = H + dimGap + textGap * 0.6;
                const leftW = Math.round(rakedSplitPos);
                const rightW = W - leftW;
                return (
                  <>
                    <line x1={0} y1={secY - tickLen * 0.8} x2={0} y2={secY + tickLen * 0.8} stroke="#888" strokeWidth={extStroke * 0.7} />
                    <line x1={rakedSplitPos} y1={secY - tickLen * 0.8} x2={rakedSplitPos} y2={secY + tickLen * 0.8} stroke="#888" strokeWidth={extStroke * 0.7} />
                    <line x1={W} y1={secY - tickLen * 0.8} x2={W} y2={secY + tickLen * 0.8} stroke="#888" strokeWidth={extStroke * 0.7} />
                    <line x1={0} y1={secY} x2={rakedSplitPos} y2={secY} stroke="#888" strokeWidth={dimStroke * 0.7} />
                    <line x1={rakedSplitPos} y1={secY} x2={W} y2={secY} stroke="#888" strokeWidth={dimStroke * 0.7} />
                    <text x={rakedSplitPos / 2} y={secY + textGap * 0.4} textAnchor="middle"
                      fontSize={fontSize * 0.75} fontWeight="500" fill="#666" fontFamily="sans-serif">
                      {leftW}
                    </text>
                    <text x={rakedSplitPos + rightW / 2} y={secY + textGap * 0.4} textAnchor="middle"
                      fontSize={fontSize * 0.75} fontWeight="500" fill="#666" fontFamily="sans-serif">
                      {rightW}
                    </text>
                  </>
                );
              })()}
            </g>
          )}
        </>
      ) : (
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
      )}

      {hasColHeightOverrides && gridMetrics && (
        <g data-testid="dimension-col-heights">
          {(() => {
            const elements: JSX.Element[] = [];
            let xPos = 0;
            const baseX = W + dimGap;
            for (let ci = 0; ci < gridMetrics.colWidths.length; ci++) {
              const colW = gridMetrics.colWidths[ci];
              const colH = gridMetrics.colEffectiveHeights[ci];
              const mmH = gridMetrics.colMmHeights[ci];
              const yTop = H - colH;
              const yBot = H;
              const labelX = xPos + colW / 2;
              elements.push(
                <g key={`ch-${ci}`}>
                  <line x1={xPos + colW + 2} y1={yTop} x2={baseX + tickLen} y2={yTop}
                    stroke="#888" strokeWidth={sectionExtStroke} />
                  <line x1={xPos + colW + 2} y1={yBot} x2={baseX + tickLen} y2={yBot}
                    stroke="#888" strokeWidth={sectionExtStroke} />
                  <text x={labelX} y={yTop + (yBot - yTop) / 2 + sectionFontSize * 0.35}
                    textAnchor="middle" fontSize={sectionFontSize}
                    fontWeight="500" fill="#1a6fbf" fontFamily="sans-serif">
                    {mmH}
                  </text>
                </g>
              );
              xPos += colW;
            }
            return elements;
          })()}
        </g>
      )}

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
              const colH = gridMetrics.colEffectiveHeights[ci];
              const yStart = H - colH;
              let yPos = yStart;
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

      {isHingeDoorStd && hingeDoorRowHeights.length > 1 && (
        <g data-testid="dimension-hinge-door-rows">
          {(() => {
            const elements: JSX.Element[] = [];
            const secX = W / 2;
            let yPos = 0;
            for (let ri = 0; ri < hingeDoorRowHeights.length; ri++) {
              const rh = hingeDoorRowHeights[ri];
              const mmH = hingeDoorRowMmHeights[ri];
              const midY = yPos + rh / 2;
              elements.push(
                <g key={`hdr-${ri}`}>
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
            return elements;
          })()}
        </g>
      )}

      {isFrenchDoor && (frenchLeftRowHeights.length > 1 || frenchRightRowHeights.length > 1) && (
        <g data-testid="dimension-french-door-rows">
          {(() => {
            const elements: JSX.Element[] = [];
            const halfW = W / 2;
            if (frenchLeftRowHeights.length > 1) {
              const secX = halfW / 2;
              let yPos = 0;
              for (let ri = 0; ri < frenchLeftRowHeights.length; ri++) {
                const rh = frenchLeftRowHeights[ri];
                const mmH = frenchLeftRowMmHeights[ri];
                elements.push(
                  <g key={`fdl-${ri}`}>
                    <text x={secX} y={yPos + rh / 2 + sectionFontSize * 0.35}
                      textAnchor="middle" fontSize={sectionFontSize}
                      fontWeight="500" fill="#666" fontFamily="sans-serif"
                      opacity={0.8}>
                      {mmH}
                    </text>
                  </g>
                );
                yPos += rh;
              }
            }
            if (frenchRightRowHeights.length > 1) {
              const secX = halfW + halfW / 2;
              let yPos = 0;
              for (let ri = 0; ri < frenchRightRowHeights.length; ri++) {
                const rh = frenchRightRowHeights[ri];
                const mmH = frenchRightRowMmHeights[ri];
                elements.push(
                  <g key={`fdr-${ri}`}>
                    <text x={secX} y={yPos + rh / 2 + sectionFontSize * 0.35}
                      textAnchor="middle" fontSize={sectionFontSize}
                      fontWeight="500" fill="#666" fontFamily="sans-serif"
                      opacity={0.8}>
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

      {(isBifoldDoor || isStackerDoor) && panelRowHeightsAll.some(rh => rh.length > 1) && (
        <g data-testid="dimension-panel-rows">
          {(() => {
            const elements: JSX.Element[] = [];
            const pw = W / panelCount;
            for (let pi = 0; pi < panelCount; pi++) {
              const rowH = panelRowHeightsAll[pi];
              const rowMmH = panelRowMmHeightsAll[pi];
              if (rowH && rowH.length > 1) {
                const secX = pi * pw + pw / 2;
                let yPos = 0;
                for (let ri = 0; ri < rowH.length; ri++) {
                  const rh = rowH[ri];
                  const mmH = rowMmH[ri];
                  elements.push(
                    <g key={`pr-${pi}-${ri}`}>
                      <text x={secX} y={yPos + rh / 2 + sectionFontSize * 0.35}
                        textAnchor="middle" fontSize={sectionFontSize}
                        fontWeight="500" fill="#666" fontFamily="sans-serif"
                        opacity={0.8}>
                        {mmH}
                      </text>
                    </g>
                  );
                  yPos += rh;
                }
              }
            }
            return elements;
          })()}
        </g>
      )}

      {isEntrance && entranceMetrics && (
        <g data-testid="dimension-entrance-sections">
          {(() => {
            const { sections, doorRowHeights, doorRowMmHeights, slRowHeights, slRowMmHeights, slLeftRowHeights, slLeftRowMmHeights } = entranceMetrics;
            const secY = H + dimGap + textGap * 0.6;
            const elements: JSX.Element[] = [];

            if (sections.length > 1) {
              sections.forEach((sec, i) => {
                const x1 = sec.x;
                const x2 = sec.x + sec.w;
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
                      {sec.mmW}
                    </text>
                  </g>
                );
              });
            }

            sections.forEach((sec) => {
              let rowH: number[];
              let rowMmH: number[];
              if (sec.role === "door") {
                rowH = doorRowHeights;
                rowMmH = doorRowMmHeights;
              } else if (sec.role === "sidelight-left") {
                rowH = slLeftRowHeights;
                rowMmH = slLeftRowMmHeights;
              } else {
                rowH = slRowHeights;
                rowMmH = slRowMmHeights;
              }
              if (rowH.length > 1) {
                const secX = sec.x + sec.w / 2;
                let yPos = 0;
                for (let ri = 0; ri < rowH.length; ri++) {
                  const rh = rowH[ri];
                  const mmH = rowMmH[ri];
                  const midY = yPos + rh / 2;
                  elements.push(
                    <g key={`eh-${sec.role}-${ri}`}>
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
              }
            });

            return elements;
          })()}
        </g>
      )}

    </svg>
  );
});

export default DrawingCanvas;
