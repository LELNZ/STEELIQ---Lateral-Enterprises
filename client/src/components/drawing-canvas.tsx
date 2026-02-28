import type { InsertQuoteItem } from "@shared/schema";

const FRAME_WIN = 52;
const FRAME_SLIDE = 127;

interface PaneProps {
  x: number;
  y: number;
  w: number;
  h: number;
  frameSize: number;
  type: "fixed" | "awning" | "hinge" | "sliding";
  hingeSide?: string;
  halfSolid?: boolean;
  strokeScale: number;
}

function Pane({ x, y, w, h, frameSize, type, hingeSide = "left", halfSolid = false, strokeScale }: PaneProps) {
  const inset = frameSize * 0.7;
  const gx = x + inset;
  const gy = y + inset;
  const gw = w - inset * 2;
  const gh = h - inset * 2;

  if (gw <= 0 || gh <= 0) return null;

  const midX = x + w / 2;
  const midY = y + h / 2;

  return (
    <g>
      <rect x={x} y={y} width={w} height={h}
        fill="#fafafa" stroke="#2d2d2d" strokeWidth={2.5 * strokeScale} />
      {halfSolid ? (
        <>
          <rect x={gx} y={gy} width={gw} height={gh / 2}
            fill="#dce8f5" stroke="#2d2d2d" strokeWidth={1 * strokeScale} />
          <rect x={gx} y={gy + gh / 2} width={gw} height={gh / 2}
            fill="url(#hatch)" stroke="#2d2d2d" strokeWidth={1 * strokeScale} />
          <line x1={gx} y1={gy + gh / 2} x2={gx + gw} y2={gy + gh / 2}
            stroke="#2d2d2d" strokeWidth={2 * strokeScale} />
        </>
      ) : (
        <rect x={gx} y={gy} width={gw} height={gh}
          fill="#dce8f5" stroke="#2d2d2d" strokeWidth={1 * strokeScale} />
      )}

      {type === "awning" && (
        <>
          <polyline
            points={`${gx},${gy + gh} ${midX},${gy} ${gx + gw},${gy + gh}`}
            fill="none" stroke="#2d2d2d" strokeWidth={1 * strokeScale} />
          <line
            x1={midX - Math.min(gw * 0.08, 20)} y1={gy + gh - inset * 0.3}
            x2={midX + Math.min(gw * 0.08, 20)} y2={gy + gh - inset * 0.3}
            stroke="#2d2d2d" strokeWidth={2.5 * strokeScale} strokeLinecap="round" />
        </>
      )}

      {type === "hinge" && hingeSide === "left" && (
        <polyline
          points={`${gx + gw},${gy} ${gx},${midY} ${gx + gw},${gy + gh}`}
          fill="none" stroke="#2d2d2d" strokeWidth={1 * strokeScale} />
      )}

      {type === "hinge" && hingeSide === "right" && (
        <polyline
          points={`${gx},${gy} ${gx + gw},${midY} ${gx},${gy + gh}`}
          fill="none" stroke="#2d2d2d" strokeWidth={1 * strokeScale} />
      )}

      {type === "sliding" && (() => {
        const arrowLen = gw * 0.25;
        const headSize = Math.min(gh * 0.025, 12);
        return (
          <g>
            <line x1={midX - arrowLen} y1={midY} x2={midX + arrowLen} y2={midY}
              stroke="#2d2d2d" strokeWidth={1.5 * strokeScale} />
            <polyline
              points={`${midX + arrowLen - headSize * 2},${midY - headSize} ${midX + arrowLen},${midY} ${midX + arrowLen - headSize * 2},${midY + headSize}`}
              fill="#2d2d2d" stroke="#2d2d2d" strokeWidth={1.5 * strokeScale} />
          </g>
        );
      })()}
    </g>
  );
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function renderDrawing(config: InsertQuoteItem, frameSize: number, ss: number) {
  const { width: W, height: H, category, layout, hingeSide, splitPosition, halfSolid, pane1Type, pane2Type, panels } = config;
  const minPane = frameSize * 2;

  if (category === "window") {
    if (layout === "fixed") {
      return <Pane x={0} y={0} w={W} h={H} frameSize={frameSize} type="fixed" strokeScale={ss} />;
    }
    if (layout === "awning") {
      return <Pane x={0} y={0} w={W} h={H} frameSize={frameSize} type="awning" strokeScale={ss} />;
    }
    if (layout === "mullion-2") {
      const splitX = clamp(splitPosition > 0 ? splitPosition : W / 2, minPane, W - minPane);
      return (
        <g>
          <Pane x={0} y={0} w={splitX} h={H} frameSize={frameSize}
            type={pane1Type === "awning" ? "awning" : "fixed"} strokeScale={ss} />
          <Pane x={splitX} y={0} w={W - splitX} h={H} frameSize={frameSize}
            type={pane2Type === "awning" ? "awning" : "fixed"} strokeScale={ss} />
        </g>
      );
    }
    if (layout === "transom-2") {
      const splitY = clamp(splitPosition > 0 ? splitPosition : H / 2, minPane, H - minPane);
      return (
        <g>
          <Pane x={0} y={0} w={W} h={splitY} frameSize={frameSize}
            type={pane1Type === "awning" ? "awning" : "fixed"} strokeScale={ss} />
          <Pane x={0} y={splitY} w={W} h={H - splitY} frameSize={frameSize}
            type={pane2Type === "awning" ? "awning" : "fixed"} strokeScale={ss} />
        </g>
      );
    }
  }

  if (category === "hinge-door") {
    if (layout === "single") {
      return <Pane x={0} y={0} w={W} h={H} frameSize={frameSize}
        type="hinge" hingeSide={hingeSide} halfSolid={halfSolid} strokeScale={ss} />;
    }
    if (layout === "with-sidelight") {
      const rawSl = splitPosition > 0 ? splitPosition : Math.min(W * 0.3, 500);
      const slWidth = clamp(rawSl, minPane, W - minPane);
      const doorWidth = W - slWidth;
      const slOnRight = hingeSide === "left";
      return (
        <g>
          {slOnRight ? (
            <>
              <Pane x={0} y={0} w={doorWidth} h={H} frameSize={frameSize}
                type="hinge" hingeSide={hingeSide} halfSolid={halfSolid} strokeScale={ss} />
              <Pane x={doorWidth} y={0} w={slWidth} h={H} frameSize={frameSize}
                type="fixed" strokeScale={ss} />
            </>
          ) : (
            <>
              <Pane x={0} y={0} w={slWidth} h={H} frameSize={frameSize}
                type="fixed" strokeScale={ss} />
              <Pane x={slWidth} y={0} w={doorWidth} h={H} frameSize={frameSize}
                type="hinge" hingeSide={hingeSide} halfSolid={halfSolid} strokeScale={ss} />
            </>
          )}
        </g>
      );
    }
    if (layout === "with-transom") {
      const transomH = clamp(splitPosition > 0 ? splitPosition : H * 0.25, minPane, H - minPane);
      return (
        <g>
          <Pane x={0} y={0} w={W} h={transomH} frameSize={frameSize}
            type="fixed" strokeScale={ss} />
          <Pane x={0} y={transomH} w={W} h={H - transomH} frameSize={frameSize}
            type="hinge" hingeSide={hingeSide} halfSolid={halfSolid} strokeScale={ss} />
        </g>
      );
    }
  }

  if (category === "sliding-door") {
    const panelCount = panels || 2;
    const pw = W / panelCount;
    return (
      <g>
        {Array.from({ length: panelCount }).map((_, i) => (
          <Pane key={i} x={i * pw} y={0} w={pw} h={H} frameSize={frameSize}
            type="sliding" strokeScale={ss} />
        ))}
      </g>
    );
  }

  if (category === "entry-door") {
    const slConfig = config.sidelightConfig || "none";
    if (slConfig === "none") {
      return <Pane x={0} y={0} w={W} h={H} frameSize={frameSize}
        type="hinge" hingeSide={hingeSide} halfSolid={halfSolid} strokeScale={ss} />;
    }
    const rawSl = splitPosition > 0 ? splitPosition : Math.min(W * 0.25, 400);
    const maxSl = slConfig === "both" ? (W - minPane) / 2 : W - minPane;
    const slWidth = clamp(rawSl, minPane, maxSl);
    if (slConfig === "left") {
      return (
        <g>
          <Pane x={0} y={0} w={slWidth} h={H} frameSize={frameSize} type="fixed" strokeScale={ss} />
          <Pane x={slWidth} y={0} w={W - slWidth} h={H} frameSize={frameSize}
            type="hinge" hingeSide={hingeSide} halfSolid={halfSolid} strokeScale={ss} />
        </g>
      );
    }
    if (slConfig === "right") {
      return (
        <g>
          <Pane x={0} y={0} w={W - slWidth} h={H} frameSize={frameSize}
            type="hinge" hingeSide={hingeSide} halfSolid={halfSolid} strokeScale={ss} />
          <Pane x={W - slWidth} y={0} w={slWidth} h={H} frameSize={frameSize} type="fixed" strokeScale={ss} />
        </g>
      );
    }
    if (slConfig === "both") {
      const doorW = W - slWidth * 2;
      return (
        <g>
          <Pane x={0} y={0} w={slWidth} h={H} frameSize={frameSize} type="fixed" strokeScale={ss} />
          <Pane x={slWidth} y={0} w={doorW} h={H} frameSize={frameSize}
            type="hinge" hingeSide={hingeSide} halfSolid={halfSolid} strokeScale={ss} />
          <Pane x={slWidth + doorW} y={0} w={slWidth} h={H} frameSize={frameSize} type="fixed" strokeScale={ss} />
        </g>
      );
    }
  }

  return <Pane x={0} y={0} w={W} h={H} frameSize={frameSize} type="fixed" strokeScale={ss} />;
}

export default function DrawingCanvas({ config }: { config: InsertQuoteItem }) {
  const { width: W, height: H, category, name, quantity } = config;
  const frameSize = category === "sliding-door" ? FRAME_SLIDE : FRAME_WIN;
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
        <line
          x1={-tickLen} y1={H + dimGap + tickLen}
          x2={tickLen} y2={H + dimGap - tickLen}
          stroke="#555" strokeWidth={dimStroke} />
        <line
          x1={W - tickLen} y1={H + dimGap + tickLen}
          x2={W + tickLen} y2={H + dimGap - tickLen}
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
        <line
          x1={-dimGap - tickLen} y1={tickLen}
          x2={-dimGap + tickLen} y2={-tickLen}
          stroke="#555" strokeWidth={dimStroke} />
        <line
          x1={-dimGap - tickLen} y1={H + tickLen}
          x2={-dimGap + tickLen} y2={H - tickLen}
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
