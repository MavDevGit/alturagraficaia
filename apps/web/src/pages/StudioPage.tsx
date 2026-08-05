import { useEffect, useMemo, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  FormControl,
  FormLabel,
  Paper,
  Slider,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import AddPhotoAlternateOutlined from "@mui/icons-material/AddPhotoAlternateOutlined";
import ArrowForwardRounded from "@mui/icons-material/ArrowForwardRounded";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import AutoFixHighRounded from "@mui/icons-material/AutoFixHighRounded";
import BoltRounded from "@mui/icons-material/BoltRounded";
import CheckRounded from "@mui/icons-material/CheckRounded";
import CloudUploadRounded from "@mui/icons-material/CloudUploadRounded";
import CropFreeRounded from "@mui/icons-material/CropFreeRounded";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import SettingsSuggestRounded from "@mui/icons-material/SettingsSuggestRounded";
import TuneRounded from "@mui/icons-material/TuneRounded";
import { useParams, useSearchParams } from "react-router";
import {
  api,
  download,
  type Asset,
  type Job,
  type Tool,
  type ViewerSource,
} from "../api/client";
import { HighResolutionCompareViewer } from "../components/HighResolutionCompareViewer";
import { OutpaintingCanvas } from "../components/OutpaintingCanvas";
import {
  defaultOutpaintingMargins,
  emptyMargins,
  maximumMargin,
  outpaintingMargins,
  sanitizeMargins,
  type CanvasMode,
  type Margins,
} from "../components/outpaintingGeometry";
import {
  defaultUpscaleConfig,
  effectiveScaleFor,
  parseUpscaleOption,
  upscaleCredits,
  upscaleOptionValue,
  upscaleOutputDimensions,
  type TargetResolution,
  type UpscaleConfig,
} from "../components/upscaleBatch";
import { StudioShell } from "../components/StudioShell";

const canvasModeLabels: Record<CanvasMode, string> = {
  manual: "Manual",
  square: "1:1",
  landscape: "16:9",
  portrait: "9:16",
};

const toolMeta: Record<
  Tool,
  {
    title: string;
    model: string;
    emptyTitle: string;
    emptyDescription: string;
    action: string;
  }
> = {
  upscaler: {
    title: "Escalador IA",
    model: "SeedVR2 Upscaler",
    emptyTitle: "Sube una imagen para ampliarla",
    emptyDescription: "El lienzo mantendrá visible el original y el resultado.",
    action: "Procesar imagen",
  },
  "background-remover": {
    title: "Quitar fondo",
    model: "Bria RMBG 2.0",
    emptyTitle: "Sube una imagen para quitar el fondo",
    emptyDescription:
      "Compara el original con la transparencia sin abandonar el lienzo.",
    action: "Quitar fondo",
  },
  outpainting: {
    title: "Expandir lienzo",
    model: "FLUX.2 Pro Outpaint",
    emptyTitle: "Sube una imagen para expandirla",
    emptyDescription:
      "Después podrás definir cada borde y anticipar el tamaño final.",
    action: "Expandir lienzo",
  },
};

const terminalStatuses = ["completed", "failed", "cancelled"];

export function StudioPage() {
  const param = useParams().tool;
  const tool: Tool =
    param === "background-remover" || param === "outpainting"
      ? param
      : "upscaler";
  const [searchParams] = useSearchParams();
  const restoredJobId = searchParams.get("job");
  const [assets, setAssets] = useState<Asset[]>([]);
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const previewUrlsRef = useRef<Record<string, string>>({});
  const [jobIds, setJobIds] = useState<string[]>(
    restoredJobId ? [restoredJobId] : [],
  );
  const [scaleMode, setScaleMode] = useState<"factor" | "resolution">(
    defaultUpscaleConfig.mode,
  );
  const [scale, setScale] = useState(defaultUpscaleConfig.scale);
  const [targetResolution, setTargetResolution] = useState<TargetResolution>(
    defaultUpscaleConfig.targetResolution,
  );
  const [upscaleConfigs, setUpscaleConfigs] = useState<
    Record<string, UpscaleConfig>
  >({});
  const [format, setFormat] = useState("png");
  const [fidelity, setFidelity] = useState(0.1);
  const [canvasMode, setCanvasMode] = useState<CanvasMode>("manual");
  const [quality, setQuality] = useState<"maximum" | "fast">("maximum");
  const [margins, setMargins] = useState<Margins>({ ...emptyMargins });
  const [notice, setNotice] = useState<{
    message: string;
    severity: "success" | "warning" | "error";
  } | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    revokeObjectUrls(previewUrlsRef.current);
    previewUrlsRef.current = {};
    setPreviewUrls({});
    setAssets([]);
    setJobIds(restoredJobId ? [restoredJobId] : []);
    setNotice(null);
    setFormat("png");
    setScale(defaultUpscaleConfig.scale);
    setScaleMode(defaultUpscaleConfig.mode);
    setTargetResolution(defaultUpscaleConfig.targetResolution);
    setUpscaleConfigs({});
    setCanvasMode("manual");
    setMargins({ ...emptyMargins });
  }, [restoredJobId, tool]);

  useEffect(() => () => revokeObjectUrls(previewUrlsRef.current), []);

  const sharedUpscaleConfig = useMemo<UpscaleConfig>(
    () => ({ mode: scaleMode, scale, targetResolution }),
    [scale, scaleMode, targetResolution],
  );
  const primaryUpscaleConfig = assets[0]
    ? (upscaleConfigs[assets[0].id] ?? sharedUpscaleConfig)
    : sharedUpscaleConfig;
  const effectiveScale = assets[0]
    ? effectiveScaleFor(assets[0], primaryUpscaleConfig)
    : scale;

  const upload = useMutation({
    mutationFn: (files: File[]) =>
      settledBatch(files, async (file) => {
        const body = new FormData();
        body.append("file", file);
        const asset = await api<Asset>("/uploads", { method: "POST", body });
        return { asset, file };
      }),
    onSuccess: ({ items, failed }) => {
      const nextPreviews = Object.fromEntries(
        items.map(({ asset, file }) => [asset.id, URL.createObjectURL(file)]),
      );
      revokeObjectUrls(previewUrlsRef.current);
      previewUrlsRef.current = nextPreviews;
      setPreviewUrls(nextPreviews);
      setAssets(items.map(({ asset }) => asset));
      setUpscaleConfigs(
        tool === "upscaler" && items.length > 1
          ? Object.fromEntries(
              items.map(({ asset }) => [
                asset.id,
                { mode: scaleMode, scale, targetResolution },
              ]),
            )
          : {},
      );
      if (tool === "outpainting" && items[0]) {
        setMargins((current) =>
          Object.values(current).every((value) => value === 0)
            ? defaultOutpaintingMargins(items[0].asset)
            : current,
        );
      }
      setNotice(
        failed
          ? {
              severity: "warning",
              message: `${items.length} imágenes cargadas; ${failed} no pudieron subirse.`,
            }
          : null,
      );
    },
  });

  const expansionFor = (asset: Asset) =>
    outpaintingSettings(asset, canvasMode, margins);

  const process = useMutation({
    mutationFn: () =>
      settledBatch(assets, (asset) => {
        const expansion = tool === "outpainting" ? expansionFor(asset) : {};
        const assetUpscale = upscaleConfigs[asset.id] ?? sharedUpscaleConfig;
        return api<Job>("/jobs", {
          method: "POST",
          body: JSON.stringify({
            tool,
            source_asset_id: asset.id,
            settings: {
              upscaleMode:
                tool === "upscaler"
                  ? assetUpscale.mode === "resolution"
                    ? "target"
                    : "factor"
                  : undefined,
              scale:
                tool === "upscaler" && assetUpscale.mode === "factor"
                  ? assetUpscale.scale
                  : undefined,
              targetResolution:
                tool === "upscaler" && assetUpscale.mode === "resolution"
                  ? assetUpscale.targetResolution
                  : undefined,
              format,
              fidelity: tool === "upscaler" ? fidelity : undefined,
              mode:
                tool === "outpainting"
                  ? quality === "fast"
                    ? "fast"
                    : "high"
                  : undefined,
              ...expansion,
            },
          }),
        });
      }),
    onSuccess: ({ items: jobs, failed }) => {
      setJobIds(jobs.map((job) => job.id));
      if (jobs[0]) {
        window.history.replaceState(
          null,
          "",
          `/studio/${tool}?job=${jobs[0].id}`,
        );
      }
      setNotice(
        failed
          ? {
              severity: "warning",
              message: `${jobs.length} trabajos iniciados; ${failed} no pudieron reservarse.`,
            }
          : jobs.length > 1
            ? {
                severity: "success",
                message: `${jobs.length} trabajos añadidos al lote.`,
              }
            : null,
      );
    },
  });

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    accept: { "image/*": [".png", ".jpg", ".jpeg", ".webp"] },
    maxFiles: 12,
    maxSize: 52_428_800,
    noClick: true,
    noKeyboard: true,
    onDropAccepted: (files) => upload.mutate(files),
    onDropRejected: () =>
      setNotice({
        severity: "error",
        message:
          "Revisa el formato, el tamaño máximo de 50 MB y el límite de 12 imágenes.",
      }),
  });

  const currentJob = useQuery({
    queryKey: ["job", jobIds[0]],
    queryFn: () => api<Job>(`/jobs/${jobIds[0]}`),
    enabled: Boolean(jobIds[0]),
    refetchInterval: (query) =>
      terminalStatuses.includes(query.state.data?.status ?? "") ? false : 1200,
  });
  useEffect(() => {
    const job = currentJob.data;
    if (!restoredJobId || !job) return;
    setAssets((current) =>
      current[0]?.id === job.source_asset.id ? current : [job.source_asset],
    );
    const restoredFormat = job.settings.format;
    if (
      restoredFormat === "png" ||
      restoredFormat === "jpeg" ||
      restoredFormat === "webp"
    ) {
      setFormat(
        job.tool === "outpainting" && restoredFormat === "webp"
          ? "png"
          : restoredFormat,
      );
    }
    if (job.tool === "outpainting") {
      setCanvasMode("manual");
      setQuality(job.settings.mode === "fast" ? "fast" : "maximum");
      setMargins(
        sanitizeMargins({
          left: numericSetting(job.settings.expandLeft),
          right: numericSetting(job.settings.expandRight),
          top: numericSetting(job.settings.expandTop),
          bottom: numericSetting(job.settings.expandBottom),
        }),
      );
    }
    if (job.tool === "upscaler") {
      const restoredMode =
        job.settings.upscaleMode === "target" ? "resolution" : "factor";
      setScaleMode(restoredMode);
      if (typeof job.settings.scale === "number") {
        setScale(Math.min(10, Math.max(1, job.settings.scale)));
      }
      if (
        ["720p", "1080p", "1440p", "2160p"].includes(
          String(job.settings.targetResolution),
        )
      ) {
        setTargetResolution(job.settings.targetResolution as TargetResolution);
      }
      if (typeof job.settings.fidelity === "number") {
        setFidelity(Math.min(1, Math.max(0, job.settings.fidelity)));
      }
    }
  }, [currentJob.data, restoredJobId]);
  const otherJobs = useQueries({
    queries: jobIds.slice(1).map((jobId) => ({
      queryKey: ["job", jobId],
      queryFn: () => api<Job>(`/jobs/${jobId}`),
      refetchInterval: (query: { state: { data?: Job } }) =>
        terminalStatuses.includes(query.state.data?.status ?? "")
          ? false
          : 1200,
    })),
  });
  const batchJobs = [
    currentJob.data,
    ...otherJobs.map((query) => query.data),
  ].filter((job): job is Job => Boolean(job));
  const completedJobs = batchJobs.filter(
    (job) => job.status === "completed",
  ).length;
  const failedJobs = batchJobs.filter((job) =>
    ["failed", "cancelled"].includes(job.status),
  ).length;
  const batchBusy =
    jobIds.length > 1 &&
    (batchJobs.length < jobIds.length ||
      batchJobs.some((job) => !terminalStatuses.includes(job.status)));
  const completed =
    currentJob.data?.status === "completed" && currentJob.data.result_asset;
  const sourceViewer = useQuery({
    queryKey: ["viewer", currentJob.data?.source_asset.id],
    queryFn: () =>
      api<ViewerSource>(`/assets/${currentJob.data!.source_asset.id}/viewer`),
    enabled: Boolean(completed),
    refetchInterval: (query) => (query.state.data?.ready ? false : 1000),
  });
  const resultViewer = useQuery({
    queryKey: ["viewer", currentJob.data?.result_asset?.id],
    queryFn: () =>
      api<ViewerSource>(`/assets/${currentJob.data!.result_asset!.id}/viewer`),
    enabled: Boolean(completed),
    refetchInterval: (query) => (query.state.data?.ready ? false : 1000),
  });
  const viewerReady = Boolean(
    sourceViewer.data?.ready &&
    sourceViewer.data.max_level !== null &&
    resultViewer.data?.ready &&
    resultViewer.data.max_level !== null,
  );
  const viewerPreparing = Boolean(completed) && !viewerReady;
  const downloadResult = useMutation({
    mutationFn: () =>
      download(
        `/assets/${currentJob.data!.result_asset!.id}/download`,
        `altura-${currentJob.data!.id}.${format}`,
      ),
  });

  const estimatedCost =
    tool === "upscaler"
      ? Math.ceil(effectiveScale / 2)
      : tool === "outpainting"
        ? 4
        : 2;
  const batchEstimatedCost =
    tool === "upscaler" && assets.length > 1
      ? assets.reduce(
          (total, asset) =>
            total +
            upscaleCredits(
              asset,
              upscaleConfigs[asset.id] ?? sharedUpscaleConfig,
            ),
          0,
        )
      : estimatedCost;
  const effectiveOutpaintingMargins = useMemo(
    () =>
      assets[0] ? outpaintingMargins(assets[0], canvasMode, margins) : margins,
    [assets, canvasMode, margins],
  );
  const dimensions = useMemo(() => {
    const asset = assets[0];
    if (!asset) return null;
    if (tool === "upscaler") {
      const output = upscaleOutputDimensions(asset, primaryUpscaleConfig);
      return {
        before: `${asset.width} × ${asset.height} px`,
        after: `${output.width} × ${output.height} px`,
      };
    }
    if (tool === "outpainting") {
      return {
        before: `${asset.width} × ${asset.height} px`,
        after: `${asset.width + effectiveOutpaintingMargins.left + effectiveOutpaintingMargins.right} × ${asset.height + effectiveOutpaintingMargins.top + effectiveOutpaintingMargins.bottom} px`,
      };
    }
    return {
      before: `${asset.width} × ${asset.height} px`,
      after: "Según resultado",
    };
  }, [assets, effectiveOutpaintingMargins, primaryUpscaleConfig, tool]);
  const busy =
    upload.isPending ||
    process.isPending ||
    Boolean(
      currentJob.data && !terminalStatuses.includes(currentJob.data.status),
    ) ||
    viewerPreparing;
  const fullyBusy = busy || batchBusy;
  const needsMargin =
    tool === "outpainting" &&
    assets.length > 0 &&
    Object.values(effectiveOutpaintingMargins).reduce(
      (total, value) => total + value,
      0,
    ) < 16;
  const canProcess =
    assets.length > 0 && !fullyBusy && !needsMargin && !completed;

  const reset = () => {
    revokeObjectUrls(previewUrlsRef.current);
    previewUrlsRef.current = {};
    setPreviewUrls({});
    setAssets([]);
    setUpscaleConfigs({});
    setJobIds([]);
    window.history.replaceState(null, "", `/studio/${tool}`);
    setNotice(null);
    upload.reset();
    process.reset();
    downloadResult.reset();
    queryClient.removeQueries({ queryKey: ["job"] });
  };

  const primaryAction = completed ? (
    <Button
      variant="contained"
      startIcon={<DownloadRounded />}
      disabled={downloadResult.isPending}
      onClick={() => downloadResult.mutate()}
    >
      {downloadResult.isPending
        ? "Preparando descarga…"
        : "Descargar resultado"}
    </Button>
  ) : (
    <Button
      variant="contained"
      startIcon={toolIcon(tool)}
      disabled={!canProcess}
      onClick={() => process.mutate()}
    >
      {assets.length > 1
        ? `${toolMeta[tool].action} (${assets.length})`
        : toolMeta[tool].action}
    </Button>
  );

  return (
    <StudioShell>
      <Box
        className={`studio-layout reference-studio ${tool === "upscaler" ? "upscaler-studio" : ""} ${tool === "upscaler" && assets.length === 0 ? "empty-upscaler" : ""} ${tool === "upscaler" && assets.length === 1 ? "single-upscaler" : ""} ${tool === "upscaler" && assets.length > 1 ? "batch-upscaler" : ""}`}
      >
        <Box className="studio-workspace">
          <Box className="canvas-column">
            {viewerReady && sourceViewer.data && resultViewer.data ? (
              <HighResolutionCompareViewer
                before={sourceViewer.data}
                after={resultViewer.data}
              />
            ) : assets.length ? (
              <Paper
                className={`processing-canvas ${previewUrls[assets[0].id] ? "has-preview" : ""} ${tool === "outpainting" ? "outpainting-processing-canvas" : ""}`}
                elevation={0}
              >
                {previewUrls[assets[0].id] && tool === "outpainting" ? (
                  <OutpaintingCanvas
                    asset={assets[0]}
                    previewUrl={previewUrls[assets[0].id]}
                    mode={canvasMode}
                    margins={effectiveOutpaintingMargins}
                    onModeChange={setCanvasMode}
                    onMarginsChange={setMargins}
                  />
                ) : (
                  <>
                    {previewUrls[assets[0].id] && (
                      <Box
                        component="img"
                        className="source-preview"
                        src={previewUrls[assets[0].id]}
                        alt="Vista previa de la imagen cargada"
                      />
                    )}
                    <Box className="file-stage">
                      <Box className="file-stage-icon">{toolIcon(tool)}</Box>
                      <Box className="file-stage-copy">
                        <Typography variant="caption" color="text.secondary">
                          Imagen cargada
                        </Typography>
                        <Typography variant="h2">
                          {assets[0].width} × {assets[0].height} píxeles
                        </Typography>
                        <Typography color="text.secondary">
                          {assets.length > 1
                            ? `Lote de ${assets.length} imágenes preparado`
                            : "Configura el trabajo en el panel derecho."}
                        </Typography>
                      </Box>
                      {tool === "upscaler" && (
                        <Button
                          className="file-stage-change"
                          size="small"
                          startIcon={<AddPhotoAlternateOutlined />}
                          onClick={open}
                        >
                          Cambiar
                        </Button>
                      )}
                    </Box>
                  </>
                )}
                {busy && (
                  <Box className="processing-beam">
                    <CircularProgress size={21} />
                    <Typography>
                      {upload.isPending
                        ? "Subiendo originales…"
                        : currentJob.data?.status === "processing"
                          ? "Procesando con IA…"
                          : "Generando mosaicos Deep Zoom…"}
                    </Typography>
                  </Box>
                )}
                {currentJob.data?.status === "failed" && (
                  <Alert severity="error">{currentJob.data.error}</Alert>
                )}
                {(process.isError ||
                  currentJob.isError ||
                  sourceViewer.isError ||
                  resultViewer.isError) && (
                  <Alert severity="error">
                    {errorMessage(
                      process.error ??
                        currentJob.error ??
                        sourceViewer.error ??
                        resultViewer.error,
                    )}
                  </Alert>
                )}
              </Paper>
            ) : (
              <Paper
                {...getRootProps()}
                className={`drop-canvas ${isDragActive ? "active" : ""}`}
                elevation={0}
              >
                <input {...getInputProps()} />
                <Box className="drop-content">
                  <Box className="upload-icon">{toolIcon(tool)}</Box>
                  <Typography variant="h2">
                    {toolMeta[tool].emptyTitle}
                  </Typography>
                  <Typography color="text.secondary">
                    {toolMeta[tool].emptyDescription}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<CloudUploadRounded />}
                    onClick={open}
                  >
                    Seleccionar imagen
                  </Button>
                  <Typography variant="caption" color="text.secondary">
                    PNG, JPG o WebP · hasta 50 MB · máximo 12 por lote
                  </Typography>
                </Box>
                {upload.isError && (
                  <Alert severity="error">{errorMessage(upload.error)}</Alert>
                )}
              </Paper>
            )}
          </Box>

          {tool === "upscaler" ? (
            <UpscalerStatusBar
              assets={assets}
              completed={Boolean(completed)}
              busy={fullyBusy}
              dimensions={dimensions}
              format={format}
              batchEstimatedCost={batchEstimatedCost}
            />
          ) : (
            <WorkflowStrip
              tool={tool}
              assets={assets}
              completed={Boolean(completed)}
              busy={fullyBusy}
              dimensions={dimensions}
              scale={effectiveScale}
              scaleMode={scaleMode}
              targetResolution={targetResolution}
              format={format}
              quality={quality}
              canvasMode={canvasMode}
              margins={effectiveOutpaintingMargins}
              batchSize={assets.length}
              batchEstimatedCost={batchEstimatedCost}
              onOpen={open}
              onProcess={() => process.mutate()}
              onDownload={() => downloadResult.mutate()}
              canProcess={canProcess}
              downloading={downloadResult.isPending}
            />
          )}
        </Box>

        <Paper
          component="aside"
          className="studio-sidebar"
          square
          elevation={0}
        >
          <Box className="inspector">
            <Box className="inspector-heading">
              <Box>
                <Typography variant="h2">Configuración</Typography>
                <Typography variant="caption" color="text.secondary">
                  {toolMeta[tool].model}
                </Typography>
              </Box>
              <TuneRounded />
            </Box>

            <Box className="inspector-scroll">
              {notice && (
                <Alert severity={notice.severity}>{notice.message}</Alert>
              )}
              {jobIds.length > 1 && (
                <Alert
                  severity={
                    failedJobs ? "warning" : batchBusy ? "info" : "success"
                  }
                >
                  Lote: {completedJobs} de {jobIds.length} completados
                  {failedJobs ? `; ${failedJobs} fallidos o cancelados` : ""}.
                </Alert>
              )}
              {downloadResult.isError && (
                <Alert severity="error">
                  {errorMessage(downloadResult.error)}
                </Alert>
              )}
              {assets.length > 1 && tool !== "upscaler" && (
                <Stack direction="row" sx={{ gap: 1, flexWrap: "wrap" }}>
                  {assets.map((asset, index) => (
                    <Chip
                      key={asset.id}
                      label={
                        index === 0 ? "Vista principal" : `Imagen ${index + 1}`
                      }
                      size="small"
                    />
                  ))}
                </Stack>
              )}

              {tool === "upscaler" && (
                <UpscalerSettings
                  scaleMode={scaleMode}
                  setScaleMode={setScaleMode}
                  scale={scale}
                  setScale={setScale}
                  targetResolution={targetResolution}
                  setTargetResolution={setTargetResolution}
                  fidelity={fidelity}
                  setFidelity={setFidelity}
                  format={format}
                  setFormat={setFormat}
                  dimensions={dimensions}
                  isBatch={assets.length > 1}
                />
              )}

              {tool === "background-remover" && <BackgroundSettings />}

              {tool === "outpainting" && (
                <OutpaintingSettings
                  quality={quality}
                  setQuality={setQuality}
                  canvasMode={canvasMode}
                  setCanvasMode={setCanvasMode}
                  margins={margins}
                  effectiveMargins={effectiveOutpaintingMargins}
                  setMargins={setMargins}
                  needsMargin={needsMargin}
                  format={format}
                  setFormat={setFormat}
                  dimensions={dimensions}
                />
              )}
            </Box>

            <Box className="inspector-primary-action">
              <Typography variant="caption" color="text.secondary">
                {tool === "upscaler" && assets.length > 1
                  ? `${batchEstimatedCost} créditos estimados para el lote`
                  : `${estimatedCost} crédito${estimatedCost === 1 ? "" : "s"} por imagen`}
              </Typography>
              {primaryAction}
            </Box>
          </Box>

          <QueuePanel
            tool={tool}
            assets={assets}
            previewUrls={previewUrls}
            jobs={batchJobs}
            completedCount={completedJobs}
            upscaleConfigs={upscaleConfigs}
            sharedUpscaleConfig={sharedUpscaleConfig}
            onUpscaleConfigChange={(assetId, config) =>
              setUpscaleConfigs((current) => ({
                ...current,
                [assetId]: config,
              }))
            }
            onClear={reset}
          />
        </Paper>

        <Box className="mobile-studio-action">{primaryAction}</Box>
      </Box>
    </StudioShell>
  );
}

function UpscalerSettings({
  scaleMode,
  setScaleMode,
  scale,
  setScale,
  targetResolution,
  setTargetResolution,
  fidelity,
  setFidelity,
  format,
  setFormat,
  dimensions,
  isBatch,
}: {
  scaleMode: "factor" | "resolution";
  setScaleMode: (value: "factor" | "resolution") => void;
  scale: number;
  setScale: (value: number) => void;
  targetResolution: TargetResolution;
  setTargetResolution: (value: TargetResolution) => void;
  fidelity: number;
  setFidelity: (value: number) => void;
  format: string;
  setFormat: (value: string) => void;
  dimensions: { before: string; after: string } | null;
  isBatch: boolean;
}) {
  return (
    <>
      {isBatch ? (
        <Box className="batch-scale-note">
          <SettingsSuggestRounded />
          <Box>
            <Typography variant="subtitle2">Escala por imagen</Typography>
            <Typography variant="caption" color="text.secondary">
              Ajusta cada salida directamente en la cola.
            </Typography>
          </Box>
        </Box>
      ) : (
        <>
          <FormControl>
            <FormLabel>Modo de escalado</FormLabel>
            <ToggleButtonGroup
              className="segmented-control"
              exclusive
              fullWidth
              value={scaleMode}
              onChange={(_, value) => value && setScaleMode(value)}
            >
              <ToggleButton value="factor">
                <ArrowForwardRounded /> Por factor
              </ToggleButton>
              <ToggleButton value="resolution">
                <SettingsSuggestRounded /> Resolución
              </ToggleButton>
            </ToggleButtonGroup>
          </FormControl>
          {scaleMode === "factor" ? (
            <ToggleButtonGroup
              className="scale-selector factor-scale-selector"
              exclusive
              fullWidth
              value={scale}
              onChange={(_, value) => value && setScale(value)}
            >
              {Array.from({ length: 10 }, (_, index) => index + 1).map(
                (value) => (
                  <ToggleButton key={value} value={value}>
                    {value}×
                  </ToggleButton>
                ),
              )}
            </ToggleButtonGroup>
          ) : (
            <ToggleButtonGroup
              className="scale-selector"
              exclusive
              fullWidth
              value={targetResolution}
              onChange={(_, value) => value && setTargetResolution(value)}
            >
              {(["720p", "1080p", "1440p", "2160p"] as const).map((value) => (
                <ToggleButton key={value} value={value}>
                  {value}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          )}
        </>
      )}
      {dimensions && !isBatch && <DimensionCard dimensions={dimensions} />}
      <FormControl>
        <FormLabel>
          <span>
            Textura y fidelidad
            <Typography variant="caption" color="text.secondary">
              Controla cuánto detalle nuevo genera la IA.
            </Typography>
          </span>
          <Chip label={fidelity.toFixed(2)} size="small" />
        </FormLabel>
        <Slider
          min={0}
          max={1}
          step={0.001}
          value={fidelity}
          onChange={(_, value) => setFidelity(value as number)}
        />
      </FormControl>
      <OutputFormat value={format} onChange={setFormat} />
    </>
  );
}

function BackgroundSettings() {
  return (
    <>
      <Box className="feature-intro">
        <Box className="feature-intro-icon">
          <AutoFixHighRounded />
        </Box>
        <Box>
          <Typography variant="h2">Recorte automático</Typography>
          <Typography variant="caption" color="text.secondary">
            Conserva cabello, bordes suaves y detalles transparentes.
          </Typography>
        </Box>
      </Box>
      <Box className="output-card">
        <Typography variant="subtitle2">Salida</Typography>
        <Box>
          <AddPhotoAlternateOutlined />
          <Typography>PNG transparente</Typography>
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary">
        Cada imagen consume créditos cuando el resultado se genera
        correctamente.
      </Typography>
    </>
  );
}

function OutpaintingSettings({
  quality,
  setQuality,
  canvasMode,
  setCanvasMode,
  margins,
  effectiveMargins,
  setMargins,
  needsMargin,
  format,
  setFormat,
  dimensions,
}: {
  quality: "maximum" | "fast";
  setQuality: (value: "maximum" | "fast") => void;
  canvasMode: CanvasMode;
  setCanvasMode: (value: CanvasMode) => void;
  margins: Margins;
  effectiveMargins: Margins;
  setMargins: (value: Margins) => void;
  needsMargin: boolean;
  format: string;
  setFormat: (value: string) => void;
  dimensions: { before: string; after: string } | null;
}) {
  return (
    <>
      <FormControl>
        <FormLabel>Calidad de procesamiento</FormLabel>
        <ToggleButtonGroup
          className="segmented-control"
          exclusive
          fullWidth
          value={quality}
          onChange={(_, value) => value && setQuality(value)}
        >
          <ToggleButton value="maximum">
            <AutoAwesomeRounded /> Máxima
          </ToggleButton>
          <ToggleButton value="fast">
            <BoltRounded /> Rápida
          </ToggleButton>
        </ToggleButtonGroup>
      </FormControl>
      <FormControl>
        <FormLabel>Relación de aspecto</FormLabel>
        <ToggleButtonGroup
          className="aspect-selector"
          exclusive
          fullWidth
          value={canvasMode}
          onChange={(_, value: CanvasMode | null) => {
            if (!value) return;
            if (value === "manual" && canvasMode !== "manual") {
              setMargins(effectiveMargins);
            }
            setCanvasMode(value);
          }}
        >
          <ToggleButton value="manual">Manual</ToggleButton>
          <ToggleButton value="square">1:1</ToggleButton>
          <ToggleButton value="landscape">16:9</ToggleButton>
          <ToggleButton value="portrait">9:16</ToggleButton>
        </ToggleButtonGroup>
      </FormControl>
      {dimensions && <DimensionCard dimensions={dimensions} />}
      <Box className="outpaint-margin-summary" aria-label="Márgenes del lienzo">
        <Chip label={`Izq. +${effectiveMargins.left} px`} size="small" />
        <Chip label={`Der. +${effectiveMargins.right} px`} size="small" />
        <Chip label={`Sup. +${effectiveMargins.top} px`} size="small" />
        <Chip label={`Inf. +${effectiveMargins.bottom} px`} size="small" />
      </Box>
      {needsMargin && (
        <Alert severity="info">
          {canvasMode === "manual"
            ? "Añade al menos 16 px de lienzo para procesar."
            : `La imagen ya coincide con ${canvasModeLabels[canvasMode]}. Elige otra relación o ajusta los bordes manualmente.`}
        </Alert>
      )}
      {canvasMode === "manual" &&
        (
          [
            ["left", "Izquierda", "Extensión horizontal."],
            ["right", "Derecha", "Extensión horizontal."],
            ["top", "Superior", "Extensión vertical."],
            ["bottom", "Inferior", "Extensión vertical."],
          ] as const
        ).map(([key, label, help]) => (
          <FormControl key={key} className="margin-control">
            <FormLabel>
              <span>
                {label}
                <Typography variant="caption" color="text.secondary">
                  {help}
                </Typography>
              </span>
              <Chip label={`${margins[key]} px`} size="small" />
            </FormLabel>
            <Slider
              min={0}
              max={maximumMargin}
              step={1}
              value={margins[key]}
              onChange={(_, value) =>
                setMargins({ ...margins, [key]: value as number })
              }
            />
          </FormControl>
        ))}
      <OutputFormat
        value={format}
        onChange={setFormat}
        formats={["png", "jpeg"]}
      />
    </>
  );
}

function OutputFormat({
  value,
  onChange,
  formats = ["png", "jpeg", "webp"],
}: {
  value: string;
  onChange: (value: string) => void;
  formats?: Array<"png" | "jpeg" | "webp">;
}) {
  return (
    <FormControl>
      <FormLabel>Formato de salida</FormLabel>
      <ToggleButtonGroup
        className="format-selector"
        exclusive
        fullWidth
        value={value}
        onChange={(_, next) => next && onChange(next)}
      >
        {formats.map((format) => (
          <ToggleButton key={format} value={format}>
            {format === "jpeg" ? "JPG" : format.toUpperCase()}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </FormControl>
  );
}

function DimensionCard({
  dimensions,
}: {
  dimensions: { before: string; after: string };
}) {
  return (
    <Box className="dimension-card">
      <span>
        <Typography variant="caption">Actual</Typography>
        <strong>{dimensions.before}</strong>
      </span>
      <ArrowForwardRounded />
      <span>
        <Typography variant="caption">Después</Typography>
        <strong>{dimensions.after}</strong>
      </span>
    </Box>
  );
}

function UpscalerStatusBar({
  assets,
  completed,
  busy,
  dimensions,
  format,
  batchEstimatedCost,
}: {
  assets: Asset[];
  completed: boolean;
  busy: boolean;
  dimensions: { before: string; after: string } | null;
  format: string;
  batchEstimatedCost: number;
}) {
  const currentStep = completed ? 3 : busy ? 2 : assets.length ? 1 : 0;
  const steps = ["Cargar", "Configurar", "Procesar", "Resultado"];
  const summary = completed
    ? "Resultado listo para descargar"
    : busy
      ? "Procesando con SeedVR2…"
      : assets.length > 1
        ? `${assets.length} imágenes · ${batchEstimatedCost} créditos estimados · ${format.toUpperCase()}`
        : dimensions
          ? `${dimensions.before} → ${dimensions.after} · ${format.toUpperCase()}`
          : "Sube una imagen para comenzar";

  return (
    <Box className="upscaler-status-bar" aria-label="Progreso del escalado">
      <Box className="upscaler-progress">
        {steps.map((step, index) => {
          const done = index < currentStep || completed;
          const current = index === currentStep && !completed;
          return (
            <Box
              key={step}
              className={`upscaler-progress-step ${done ? "done" : ""} ${current ? "current" : ""}`}
            >
              <span>{done ? <CheckRounded /> : index + 1}</span>
              <Typography variant="caption">{step}</Typography>
            </Box>
          );
        })}
      </Box>
      <Typography className="upscaler-status-summary" variant="caption">
        {summary}
      </Typography>
    </Box>
  );
}

function WorkflowStrip({
  tool,
  assets,
  completed,
  busy,
  dimensions,
  scale,
  scaleMode,
  targetResolution,
  format,
  quality,
  canvasMode,
  margins,
  batchSize,
  batchEstimatedCost,
  onOpen,
  onProcess,
  onDownload,
  canProcess,
  downloading,
}: {
  tool: Tool;
  assets: Asset[];
  completed: boolean;
  busy: boolean;
  dimensions: { before: string; after: string } | null;
  scale: number;
  scaleMode: "factor" | "resolution";
  targetResolution: TargetResolution;
  format: string;
  quality: "maximum" | "fast";
  canvasMode: CanvasMode;
  margins: Margins;
  batchSize: number;
  batchEstimatedCost: number;
  onOpen: () => void;
  onProcess: () => void;
  onDownload: () => void;
  canProcess: boolean;
  downloading: boolean;
}) {
  const steps = ["Cargar", "Configurar", "Procesar", "Descargar"];
  return (
    <Box className="workflow-strip detailed-workflow">
      {steps.map((step, index) => {
        const done = completed || (assets.length > 0 && index < 2);
        return (
          <Box key={step} className={`workflow-step ${done ? "done" : ""}`}>
            <Box className="workflow-step-heading">
              <span>{done ? <CheckRounded /> : index + 1}</span>
              <Typography>{step}</Typography>
            </Box>
            <Box className="workflow-step-content">
              {index === 0 && (
                <>
                  <Typography variant="caption" color="text.secondary">
                    {dimensions?.before ?? "Carga una imagen para comenzar."}
                  </Typography>
                  <Button
                    className="workflow-step-action"
                    startIcon={<AddPhotoAlternateOutlined />}
                    onClick={onOpen}
                  >
                    {assets.length ? "Cambiar imagen" : "Elegir imagen"}
                  </Button>
                </>
              )}
              {index === 1 && (
                <SettingsSummary
                  tool={tool}
                  scale={scale}
                  scaleMode={scaleMode}
                  targetResolution={targetResolution}
                  format={format}
                  quality={quality}
                  canvasMode={canvasMode}
                  margins={margins}
                  batchSize={batchSize}
                  batchEstimatedCost={batchEstimatedCost}
                />
              )}
              {index === 2 && (
                <>
                  <Typography variant="caption" color="text.secondary">
                    {busy
                      ? "El motor IA está trabajando."
                      : completed
                        ? "Procesamiento completado."
                        : "Configura y carga una imagen para procesar."}
                  </Typography>
                  <Button
                    className="workflow-step-action"
                    variant="contained"
                    startIcon={<AutoAwesomeRounded />}
                    disabled={!canProcess}
                    onClick={onProcess}
                  >
                    Iniciar proceso
                  </Button>
                </>
              )}
              {index === 3 && (
                <>
                  <Typography variant="caption" color="text.secondary">
                    {completed
                      ? "El resultado está listo."
                      : "Estará disponible al completar el proceso."}
                  </Typography>
                  <Button
                    className="workflow-step-action"
                    variant="outlined"
                    startIcon={<DownloadRounded />}
                    disabled={!completed || downloading}
                    onClick={onDownload}
                  >
                    {downloading ? "Preparando…" : "Descargar"}
                  </Button>
                </>
              )}
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}

function SettingsSummary({
  tool,
  scale,
  scaleMode,
  targetResolution,
  format,
  quality,
  canvasMode,
  margins,
  batchSize,
  batchEstimatedCost,
}: {
  tool: Tool;
  scale: number;
  scaleMode: "factor" | "resolution";
  targetResolution: TargetResolution;
  format: string;
  quality: "maximum" | "fast";
  canvasMode: CanvasMode;
  margins: Margins;
  batchSize: number;
  batchEstimatedCost: number;
}) {
  const rows =
    tool === "upscaler"
      ? batchSize > 1
        ? [
            ["Escala", "Individual por imagen"],
            ["Lote", `${batchSize} imágenes · ${batchEstimatedCost} créditos`],
            ["Formato", format.toUpperCase()],
          ]
        : [
            [
              scaleMode === "resolution" ? "Objetivo" : "Escala",
              scaleMode === "resolution" ? targetResolution : `${scale}×`,
            ],
            ["Formato", format.toUpperCase()],
          ]
      : tool === "background-remover"
        ? [
            ["Modelo", "RMBG 2.0"],
            ["Salida", "PNG"],
            ["Fondo", "Transparente"],
          ]
        : [
            [
              "Modelo",
              `FLUX.2 Pro · ${quality === "fast" ? "Rápida" : "Alta"}`,
            ],
            ["Relación", canvasModeLabels[canvasMode]],
            [
              "Márgenes",
              `H ${margins.left + margins.right} · V ${margins.top + margins.bottom} px`,
            ],
            ["Formato", format.toUpperCase()],
          ];
  return (
    <Box component="dl" className="workflow-summary">
      {rows.map(([label, value]) => (
        <Box key={label}>
          <Typography component="dt" variant="caption" color="text.secondary">
            {label}
          </Typography>
          <Typography component="dd" variant="caption">
            {value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

function QueuePanel({
  tool,
  assets,
  previewUrls,
  jobs,
  completedCount,
  upscaleConfigs,
  sharedUpscaleConfig,
  onUpscaleConfigChange,
  onClear,
}: {
  tool: Tool;
  assets: Asset[];
  previewUrls: Record<string, string>;
  jobs: Job[];
  completedCount: number;
  upscaleConfigs: Record<string, UpscaleConfig>;
  sharedUpscaleConfig: UpscaleConfig;
  onUpscaleConfigChange: (assetId: string, config: UpscaleConfig) => void;
  onClear: () => void;
}) {
  return (
    <Box className="queue-panel">
      <Box className="queue-heading">
        <Typography>Cola ({assets.length})</Typography>
        <Button size="small" disabled={!assets.length} onClick={onClear}>
          Limpiar
        </Button>
      </Box>
      {assets.length === 0 ? (
        <Typography variant="caption" color="text.secondary">
          La cola aparecerá aquí.
        </Typography>
      ) : (
        <Stack className="queue-list">
          {assets.map((asset, index) => {
            const job = jobs.at(index);
            const status: Job["status"] | "ready" = job ? job.status : "ready";
            const configurableUpscale =
              tool === "upscaler" && assets.length > 1;
            const upscaleConfig =
              upscaleConfigs[asset.id] ?? sharedUpscaleConfig;
            const output = upscaleOutputDimensions(asset, upscaleConfig);
            const credits = upscaleCredits(asset, upscaleConfig);
            return (
              <Box
                key={asset.id}
                className={`queue-item ${configurableUpscale ? "configurable" : ""}`}
              >
                <Box className="queue-item-head">
                  <Box className="queue-thumbnail">
                    {previewUrls[asset.id] ? (
                      <Box component="img" src={previewUrls[asset.id]} alt="" />
                    ) : (
                      <AddPhotoAlternateOutlined />
                    )}
                  </Box>
                  <Box className="queue-item-copy">
                    <Typography variant="body2">Imagen {index + 1}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {asset.width} × {asset.height} px
                    </Typography>
                    <Typography
                      variant="caption"
                      className={`queue-status ${status}`}
                    >
                      {status === "ready"
                        ? "Lista para procesar"
                        : status === "completed"
                          ? "Completado"
                          : status === "failed"
                            ? "Fallido"
                            : "Procesando"}
                    </Typography>
                  </Box>
                  {index < completedCount && <CheckRounded />}
                </Box>
                {configurableUpscale && (
                  <Box className="queue-upscale-config">
                    <Box
                      component="label"
                      htmlFor={`scale-${asset.id}`}
                      className="queue-scale-label"
                    >
                      Escala individual
                    </Box>
                    <Box
                      component="select"
                      id={`scale-${asset.id}`}
                      aria-label={`Escala de Imagen ${index + 1}`}
                      className="queue-scale-select"
                      value={upscaleOptionValue(upscaleConfig)}
                      disabled={Boolean(job)}
                      onChange={(event) =>
                        onUpscaleConfigChange(
                          asset.id,
                          parseUpscaleOption(event.target.value, upscaleConfig),
                        )
                      }
                    >
                      <optgroup label="Por factor">
                        {Array.from({ length: 10 }, (_, item) => item + 1).map(
                          (factor) => (
                            <option key={factor} value={`factor:${factor}`}>
                              {factor}×
                            </option>
                          ),
                        )}
                      </optgroup>
                      <optgroup label="Resolución objetivo">
                        {(["720p", "1080p", "1440p", "2160p"] as const).map(
                          (resolution) => (
                            <option
                              key={resolution}
                              value={`resolution:${resolution}`}
                            >
                              {resolution}
                            </option>
                          ),
                        )}
                      </optgroup>
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      Salida {output.width} × {output.height} px · {credits}{" "}
                      crédito{credits === 1 ? "" : "s"}
                    </Typography>
                  </Box>
                )}
              </Box>
            );
          })}
        </Stack>
      )}
    </Box>
  );
}

function revokeObjectUrls(urls: Record<string, string>) {
  Object.values(urls).forEach((url) => URL.revokeObjectURL(url));
}

function toolIcon(tool: Tool) {
  if (tool === "background-remover") return <AutoFixHighRounded />;
  if (tool === "outpainting") return <CropFreeRounded />;
  return <AddPhotoAlternateOutlined />;
}

function outpaintingSettings(asset: Asset, mode: CanvasMode, margins: Margins) {
  const resolved = outpaintingMargins(asset, mode, margins);
  return {
    expandTop: resolved.top,
    expandBottom: resolved.bottom,
    expandLeft: resolved.left,
    expandRight: resolved.right,
  };
}

function numericSetting(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function errorMessage(reason: unknown): string {
  return reason instanceof Error
    ? reason.message
    : "La operación no pudo completarse. Intenta nuevamente.";
}

async function settledBatch<Input, Output>(
  inputs: Input[],
  operation: (input: Input) => Promise<Output>,
): Promise<{ items: Output[]; failed: number }> {
  const results = await Promise.allSettled(inputs.map(operation));
  const items = results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );
  const failed = results.length - items.length;
  if (!items.length && failed) {
    const firstFailure = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    throw (
      firstFailure?.reason ?? new Error("Ninguna operación pudo completarse.")
    );
  }
  return { items, failed };
}
