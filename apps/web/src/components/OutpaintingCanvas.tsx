import {
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { Box, Button, Chip, Typography } from "@mui/material";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import CenterFocusStrongRounded from "@mui/icons-material/CenterFocusStrongRounded";
import DragIndicatorRounded from "@mui/icons-material/DragIndicatorRounded";
import type { Asset } from "../api/client";
import {
  centeredMargins,
  changeMargin,
  marginStep,
  maximumMargin,
  outpaintingDimensions,
  type CanvasMode,
  type MarginSide,
  type Margins,
} from "./outpaintingGeometry";

type DragState = {
  side: MarginSide;
  x: number;
  y: number;
  pixelsPerSourcePixel: number;
  margins: Margins;
};

const sideLabels: Record<MarginSide, string> = {
  left: "margen izquierdo",
  right: "margen derecho",
  top: "margen superior",
  bottom: "margen inferior",
};

export function OutpaintingCanvas({
  asset,
  previewUrl,
  mode,
  margins,
  onModeChange,
  onMarginsChange,
}: {
  asset: Asset;
  previewUrl: string;
  mode: CanvasMode;
  margins: Margins;
  onModeChange: (mode: CanvasMode) => void;
  onMarginsChange: (margins: Margins) => void;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const modeRef = useRef(mode);
  const onModeChangeRef = useRef(onModeChange);
  const onMarginsChangeRef = useRef(onMarginsChange);
  modeRef.current = mode;
  onModeChangeRef.current = onModeChange;
  onMarginsChangeRef.current = onMarginsChange;
  const dimensions = outpaintingDimensions(asset, margins);
  const originalStyle = {
    left: `${(margins.left / dimensions.width) * 100}%`,
    top: `${(margins.top / dimensions.height) * 100}%`,
    width: `${(asset.width / dimensions.width) * 100}%`,
    height: `${(asset.height / dimensions.height) * 100}%`,
  };

  const startDrag = (
    side: MarginSide,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = {
      side,
      x: event.clientX,
      y: event.clientY,
      pixelsPerSourcePixel: Math.max(rect.width / dimensions.width, 0.001),
      margins,
    };
  };

  const stopDrag = () => {
    dragRef.current = null;
  };

  useEffect(() => {
    const continueDrag = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      event.preventDefault();
      const horizontalDelta =
        (event.clientX - drag.x) / drag.pixelsPerSourcePixel;
      const verticalDelta =
        (event.clientY - drag.y) / drag.pixelsPerSourcePixel;
      const delta =
        drag.side === "left"
          ? -horizontalDelta
          : drag.side === "right"
            ? horizontalDelta
            : drag.side === "top"
              ? -verticalDelta
              : verticalDelta;
      if (Math.abs(delta) < 1) return;
      if (modeRef.current !== "manual") {
        modeRef.current = "manual";
        onModeChangeRef.current("manual");
      }
      onMarginsChangeRef.current(changeMargin(drag.margins, drag.side, delta));
    };
    const finishDrag = () => stopDrag();
    window.addEventListener("pointermove", continueDrag, { passive: false });
    window.addEventListener("pointerup", finishDrag);
    window.addEventListener("pointercancel", finishDrag);
    return () => {
      window.removeEventListener("pointermove", continueDrag);
      window.removeEventListener("pointerup", finishDrag);
      window.removeEventListener("pointercancel", finishDrag);
    };
  }, []);

  const changeWithKeyboard = (
    side: MarginSide,
    event: React.KeyboardEvent<HTMLButtonElement>,
  ) => {
    const visualIncreaseKey =
      (side === "left" && event.key === "ArrowLeft") ||
      (side === "right" && event.key === "ArrowRight") ||
      (side === "top" && event.key === "ArrowUp") ||
      (side === "bottom" && event.key === "ArrowDown");
    const visualDecreaseKey =
      (side === "left" && event.key === "ArrowRight") ||
      (side === "right" && event.key === "ArrowLeft") ||
      (side === "top" && event.key === "ArrowDown") ||
      (side === "bottom" && event.key === "ArrowUp");
    if (!visualIncreaseKey && !visualDecreaseKey) return;
    event.preventDefault();
    if (mode !== "manual") onModeChange("manual");
    onMarginsChange(
      changeMargin(margins, side, visualIncreaseKey ? marginStep : -marginStep),
    );
  };

  return (
    <Box className="outpaint-editor">
      <Box className="outpaint-dimension-banner" aria-live="polite">
        <Chip label={`Original  ${asset.width} × ${asset.height} px`} />
        <ArrowForwardRounded />
        <Chip
          color="primary"
          label={`Final  ${dimensions.width} × ${dimensions.height} px`}
        />
        <Typography variant="caption" color="text.secondary">
          Izq. +{margins.left} · Der. +{margins.right} · Sup. +{margins.top} ·
          Inf. +{margins.bottom} px
        </Typography>
      </Box>

      <Box className="outpaint-stage-region">
        <Box
          ref={stageRef}
          className="outpaint-stage"
          style={
            {
              aspectRatio: `${dimensions.width} / ${dimensions.height}`,
              "--outpaint-ratio": dimensions.width / dimensions.height,
            } as CSSProperties
          }
        >
          <Box
            component="img"
            src={previewUrl}
            alt="Vista previa del lienzo que se expandirá"
            className="outpaint-original"
            style={originalStyle}
          />
          <Box className="outpaint-original-outline" style={originalStyle} />
          {(["top", "right", "bottom", "left"] as const).map((side) => (
            <Box
              component="button"
              type="button"
              key={side}
              className={`outpaint-handle ${side}`}
              role="slider"
              aria-label={`Ajustar ${sideLabels[side]}`}
              aria-valuemin={0}
              aria-valuemax={maximumMargin}
              aria-valuenow={margins[side]}
              onPointerDown={(event) => startDrag(side, event)}
              onPointerUp={stopDrag}
              onPointerCancel={stopDrag}
              onKeyDown={(event) => changeWithKeyboard(side, event)}
            >
              <DragIndicatorRounded />
            </Box>
          ))}
        </Box>
      </Box>

      <Box className="outpaint-editor-footer">
        <Typography variant="caption" color="text.secondary">
          Arrastra cualquier borde para definir cuánto lienzo añadirá la IA.
        </Typography>
        <Button
          size="small"
          startIcon={<CenterFocusStrongRounded />}
          onClick={() => {
            onModeChange("manual");
            onMarginsChange(centeredMargins(margins));
          }}
        >
          Centrar márgenes
        </Button>
      </Box>
    </Box>
  );
}
