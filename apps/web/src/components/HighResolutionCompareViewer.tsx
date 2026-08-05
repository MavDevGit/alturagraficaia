import { useCallback, useEffect, useRef, useState } from "react";
import OpenSeadragon from "openseadragon";
import {
  Box,
  Button,
  ButtonGroup,
  Chip,
  IconButton,
  Slider,
  Tooltip,
  Typography,
} from "@mui/material";
import CenterFocusStrongRounded from "@mui/icons-material/CenterFocusStrongRounded";
import FitScreenRounded from "@mui/icons-material/FitScreenRounded";
import SplitscreenRounded from "@mui/icons-material/SplitscreenRounded";
import SwapHorizRounded from "@mui/icons-material/SwapHorizRounded";
import ZoomInRounded from "@mui/icons-material/ZoomInRounded";
import ZoomOutRounded from "@mui/icons-material/ZoomOutRounded";
import VerifiedRounded from "@mui/icons-material/VerifiedRounded";
import type { ViewerSource } from "../api/client";
import { createTileSource } from "./tileSource";

type Mode = "slider" | "side";

export function HighResolutionCompareViewer({
  before,
  after,
}: {
  before: ViewerSource;
  after: ViewerSource;
}) {
  const beforeNode = useRef<HTMLDivElement>(null);
  const afterNode = useRef<HTMLDivElement>(null);
  const stageNode = useRef<HTMLDivElement>(null);
  const viewers = useRef<{
    before?: OpenSeadragon.Viewer;
    after?: OpenSeadragon.Viewer;
  }>({});
  const syncing = useRef(false);
  const [mode, setMode] = useState<Mode>("slider");
  const [position, setPosition] = useState(50);
  const [zoom, setZoom] = useState(100);

  const synchronize = useCallback(
    (
      source: OpenSeadragon.Viewer,
      target: OpenSeadragon.Viewer,
      sourceInfo: ViewerSource,
      targetInfo: ViewerSource,
    ) => {
      if (
        syncing.current ||
        !source.world.getItemCount() ||
        !target.world.getItemCount()
      )
        return;
      syncing.current = true;
      const sourceItem = source.world.getItemAt(0);
      const targetItem = target.world.getItemAt(0);
      const imageCenter = sourceItem.viewportToImageCoordinates(
        source.viewport.getCenter(true),
      );
      const normalized = new OpenSeadragon.Point(
        imageCenter.x / sourceInfo.width,
        imageCenter.y / sourceInfo.height,
      );
      const targetCenter = targetItem.imageToViewportCoordinates(
        new OpenSeadragon.Point(
          normalized.x * targetInfo.width,
          normalized.y * targetInfo.height,
        ),
      );
      const relativeZoom =
        source.viewport.getZoom(true) / source.viewport.getHomeZoom();
      target.viewport.zoomTo(
        target.viewport.getHomeZoom() * relativeZoom,
        targetCenter,
        true,
      );
      target.viewport.panTo(targetCenter, true);
      const afterViewer = viewers.current.after;
      if (afterViewer?.world.getItemCount())
        setZoom(
          Math.max(
            1,
            Math.round(
              afterViewer.viewport.viewportToImageZoom(
                afterViewer.viewport.getZoom(true),
              ) * 100,
            ),
          ),
        );
      requestAnimationFrame(() => {
        syncing.current = false;
      });
    },
    [],
  );

  useEffect(() => {
    if (!beforeNode.current || !afterNode.current) return;
    const shared: OpenSeadragon.Options = {
      showNavigationControl: false,
      animationTime: 0.18,
      blendTime: 0,
      constrainDuringPan: true,
      visibilityRatio: 0.35,
      minZoomImageRatio: 0.72,
      maxZoomPixelRatio: 2,
      zoomPerScroll: 1.22,
      gestureSettingsMouse: {
        clickToZoom: false,
        dblClickToZoom: true,
        pinchToZoom: true,
        scrollToZoom: false,
        flickEnabled: true,
      },
      crossOriginPolicy: "Anonymous",
      immediateRender: true,
      preserveImageSizeOnResize: true,
    };
    const beforeViewer = OpenSeadragon({
      ...shared,
      element: beforeNode.current,
      tileSources: createTileSource(before) as OpenSeadragon.TileSourceOptions,
    });
    const afterViewer = OpenSeadragon({
      ...shared,
      element: afterNode.current,
      tileSources: createTileSource(after) as OpenSeadragon.TileSourceOptions,
      mouseNavEnabled: mode === "side",
    });
    viewers.current = { before: beforeViewer, after: afterViewer };
    const fromBefore = () =>
      synchronize(beforeViewer, afterViewer, before, after);
    const fromAfter = () =>
      mode === "side" && synchronize(afterViewer, beforeViewer, after, before);
    beforeViewer.addHandler("viewport-change", fromBefore);
    afterViewer.addHandler("viewport-change", fromAfter);
    let beforeOpen = false;
    let afterOpen = false;
    const initialize = () => {
      if (beforeOpen && afterOpen) requestAnimationFrame(fromBefore);
    };
    beforeViewer.addHandler("open", () => {
      beforeOpen = true;
      initialize();
    });
    afterViewer.addHandler("open", () => {
      afterOpen = true;
      initialize();
    });
    return () => {
      beforeViewer.destroy();
      afterViewer.destroy();
      viewers.current = {};
    };
  }, [after, before, mode, synchronize]);

  const fit = () => {
    viewers.current.before?.viewport.goHome(false);
    requestAnimationFrame(
      () =>
        viewers.current.after &&
        viewers.current.before &&
        synchronize(
          viewers.current.before,
          viewers.current.after,
          before,
          after,
        ),
    );
  };
  const actual = () => {
    const first = viewers.current.before;
    const second = viewers.current.after;
    if (!first || !second || !second.world.getItemCount()) return;
    const after100 = second.viewport.imageToViewportZoom(1);
    const ratio = after100 / second.viewport.getHomeZoom();
    first.viewport.zoomTo(
      first.viewport.getHomeZoom() * ratio,
      undefined,
      false,
    );
    synchronize(first, second, before, after);
  };
  const zoomBy = (factor: number) => {
    viewers.current.before?.viewport.zoomBy(factor);
    viewers.current.before?.viewport.applyConstraints();
  };
  const wheelZoom = useCallback(
    (event: WheelEvent) => {
      event.preventDefault();
      const first = viewers.current.before;
      const second = viewers.current.after;
      if (!first || !second || !beforeNode.current || !afterNode.current)
        return;
      const useAfter =
        mode === "side" &&
        event.clientX >=
          (stageNode.current?.getBoundingClientRect().left ?? 0) +
            (stageNode.current?.clientWidth ?? 0) / 2;
      const source = useAfter ? second : first;
      const target = useAfter ? first : second;
      const sourceInfo = useAfter ? after : before;
      const targetInfo = useAfter ? before : after;
      const rect = (
        useAfter ? afterNode.current : beforeNode.current
      ).getBoundingClientRect();
      const anchor = source.viewport.pointFromPixel(
        new OpenSeadragon.Point(
          event.clientX - rect.left,
          event.clientY - rect.top,
        ),
        true,
      );
      source.viewport.zoomBy(Math.pow(1.0015, -event.deltaY), anchor);
      source.viewport.applyConstraints();
      synchronize(source, target, sourceInfo, targetInfo);
    },
    [after, before, mode, synchronize],
  );
  useEffect(() => {
    const stage = stageNode.current;
    if (!stage) return;
    stage.addEventListener("wheel", wheelZoom, { passive: false });
    return () => stage.removeEventListener("wheel", wheelZoom);
  }, [wheelZoom]);
  const setFromPointer = (clientX: number) => {
    const rect = stageNode.current?.getBoundingClientRect();
    if (!rect) return;
    setPosition(
      Math.min(98, Math.max(2, ((clientX - rect.left) / rect.width) * 100)),
    );
  };

  return (
    <Box className="compare-viewer" data-mode={mode}>
      <Box ref={stageNode} className="compare-stage">
        <Box className="viewer-pane before-pane">
          <div ref={beforeNode} className="osd-host" />
          <Chip className="viewer-label" label="Antes" size="small" />
        </Box>
        <Chip
          className="viewer-quality-badge"
          icon={<VerifiedRounded />}
          label="Detalle original"
          size="small"
        />
        <Box
          className="viewer-pane after-pane"
          style={
            mode === "slider"
              ? { clipPath: `inset(0 0 0 ${position}%)`, pointerEvents: "none" }
              : undefined
          }
        >
          <div ref={afterNode} className="osd-host" />
          <Chip
            className="viewer-label after-label"
            label="Después"
            size="small"
            color="primary"
          />
        </Box>
        {mode === "slider" && (
          <Box
            component="button"
            type="button"
            role="slider"
            aria-label="Posición del comparador"
            aria-valuemin={2}
            aria-valuemax={98}
            aria-valuenow={Math.round(position)}
            className="compare-divider"
            style={{ left: `${position}%` }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              setFromPointer(event.clientX);
            }}
            onPointerMove={(event) =>
              event.currentTarget.hasPointerCapture(event.pointerId) &&
              setFromPointer(event.clientX)
            }
            onKeyDown={(event) => {
              if (event.key === "ArrowLeft" || event.key === "ArrowDown") {
                event.preventDefault();
                setPosition((current) => Math.max(2, current - 2));
              }
              if (event.key === "ArrowRight" || event.key === "ArrowUp") {
                event.preventDefault();
                setPosition((current) => Math.min(98, current + 2));
              }
              if (event.key === "Home") setPosition(2);
              if (event.key === "End") setPosition(98);
            }}
          >
            <span>
              <SwapHorizRounded />
            </span>
          </Box>
        )}
        {(!before.ready || !after.ready) && (
          <Box className="tile-warning">
            <Typography variant="caption">
              Preparando mosaicos de alta resolución…
            </Typography>
          </Box>
        )}
      </Box>
      <Box className="viewer-toolbar">
        <ButtonGroup className="viewer-mode-switch" size="small" aria-label="Modo de comparación">
          <Button
            variant={mode === "slider" ? "contained" : "outlined"}
            onClick={() => setMode("slider")}
            startIcon={<SwapHorizRounded />}
          >
            Slider
          </Button>
          <Button
            variant={mode === "side" ? "contained" : "outlined"}
            onClick={() => setMode("side")}
            startIcon={<SplitscreenRounded />}
          >
            Lado a lado
          </Button>
        </ButtonGroup>
        {mode === "slider" && (
          <Slider
            size="small"
            className="position-slider"
            value={position}
            onChange={(_, value) => setPosition(value as number)}
            min={2}
            max={98}
            aria-label="Posición del comparador"
          />
        )}
        <Box sx={{ flex: 1 }} />
        <Tooltip title="Alejar">
          <IconButton aria-label="Alejar" onClick={() => zoomBy(1 / 1.25)}>
            <ZoomOutRounded />
          </IconButton>
        </Tooltip>
        <Typography className="zoom-readout">{zoom}%</Typography>
        <Tooltip title="Acercar">
          <IconButton aria-label="Acercar" onClick={() => zoomBy(1.25)}>
            <ZoomInRounded />
          </IconButton>
        </Tooltip>
        <Tooltip title="Ver archivo procesado al 100%">
          <Button
            size="small"
            onClick={actual}
            startIcon={<CenterFocusStrongRounded />}
          >
            100% real
          </Button>
        </Tooltip>
        <Tooltip title="Ajustar al lienzo">
          <IconButton aria-label="Ajustar al lienzo" onClick={fit}>
            <FitScreenRounded />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
}
