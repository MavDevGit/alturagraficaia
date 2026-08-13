import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "../components/ui";
import {
  ArrowUpRight as ArrowOutwardRounded,
  Download as DownloadRounded,
  ImageOff as ImageNotSupportedRounded,
  ImagePlus as AddPhotoAlternateRounded,
} from "lucide-react";
import { Link } from "react-router";
import { api, download, type Job } from "../api/client";
import { StudioShell } from "../components/StudioShell";

type JobsPage = {
  data: Job[];
  meta: { current_page: number; last_page: number; total: number };
};

const statusLabels: Record<Job["status"], string> = {
  queued: "En cola",
  processing: "Procesando",
  completed: "Completado",
  failed: "Fallido",
  cancelled: "Cancelado",
};

function historyStatus(job: Job): {
  label: string;
  color: "success" | "error" | "default";
} {
  if (job.status === "completed" && job.result_asset?.status === "expired") {
    return { label: "Archivo vencido", color: "default" };
  }
  if (job.status === "completed" && job.result_asset?.status === "failed") {
    return { label: "No disponible", color: "error" };
  }

  return {
    label: statusLabels[job.status],
    color:
      job.status === "completed"
        ? "success"
        : job.status === "failed"
          ? "error"
          : "default",
  };
}

function hasAvailableResult(job: Job): boolean {
  return job.status === "completed" && job.result_asset?.status === "ready";
}

const toolLabels: Record<Job["tool"], string> = {
  upscaler: "Escalador IA",
  "background-remover": "Quitar fondo",
  outpainting: "Expandir lienzo",
};

function resultPath(job: Job): string {
  return `/studio/${job.tool}?job=${job.id}`;
}

function displayedAsset(job: Job) {
  return job.status === "completed" && job.result_asset
    ? job.result_asset
    : job.source_asset;
}

function extensionFor(job: Job): string {
  const mime = job.result_asset?.mime_type;
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  return "png";
}

function HistoryThumbnail({ job }: { job: Job }) {
  const asset = displayedAsset(job);
  const fallbackThumbnailUrl =
    asset.id === job.source_asset.id
      ? undefined
      : job.source_asset.thumbnail_url;
  const [thumbnailUrl, setThumbnailUrl] = useState(asset.thumbnail_url);
  const [thumbnailState, setThumbnailState] = useState<
    "loading" | "loaded" | "failed"
  >(asset.status === "ready" && thumbnailUrl ? "loading" : "failed");

  return (
    <Box
      className={`history-card-visual ${thumbnailState === "loaded" ? "has-thumbnail" : ""}`}
      aria-label={`${asset.width} por ${asset.height} píxeles`}
    >
      {asset.status === "ready" &&
        thumbnailUrl &&
        thumbnailState !== "failed" && (
          <img
            src={thumbnailUrl}
            alt=""
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            width={asset.width}
            height={asset.height}
            onLoad={() => setThumbnailState("loaded")}
            onError={() => {
              if (
                fallbackThumbnailUrl &&
                thumbnailUrl !== fallbackThumbnailUrl
              ) {
                setThumbnailUrl(fallbackThumbnailUrl);
                return;
              }
              setThumbnailState("failed");
            }}
          />
        )}
      {thumbnailState === "loading" && (
        <CircularProgress size={24} aria-label="Cargando previsualización" />
      )}
      {thumbnailState === "failed" && <ImageNotSupportedRounded />}
    </Box>
  );
}

export function HistoryPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const jobs = useInfiniteQuery({
    queryKey: ["jobs"],
    initialPageParam: 1,
    queryFn: ({ pageParam }) => api<JobsPage>(`/jobs?page=${pageParam}`),
    getNextPageParam: (lastPage) =>
      lastPage.meta.current_page < lastPage.meta.last_page
        ? lastPage.meta.current_page + 1
        : undefined,
  });
  const items = jobs.data?.pages.flatMap((page) => page.data) ?? [];

  const startDownload = async (job: Job) => {
    if (!job.result_asset) return;
    setDownloadError(null);
    setDownloading(job.id);
    try {
      await download(
        `/assets/${job.result_asset.id}/download`,
        `altura-${job.id}.${extensionFor(job)}`,
      );
    } catch (error) {
      setDownloadError(
        error instanceof Error
          ? error.message
          : "No se pudo descargar el archivo.",
      );
    } finally {
      setDownloading(null);
    }
  };

  return (
    <StudioShell>
      <Box className="content-page">
        <Box className="page-heading">
          <Box>
            <Typography variant="overline">Biblioteca temporal</Typography>
            <Typography variant="h1">Tus resultados recientes</Typography>
            <Typography color="text.secondary">
              Los originales y los enlaces de resultados caducan a los siete
              días.
            </Typography>
          </Box>
          <Button
            component={Link}
            to="/studio/upscaler"
            variant="contained"
            startIcon={<AddPhotoAlternateRounded />}
          >
            Nuevo proyecto
          </Button>
        </Box>
        {jobs.isLoading && <CircularProgress aria-label="Cargando historial" />}
        {jobs.isError && (
          <Alert
            severity="error"
            action={<Button onClick={() => jobs.refetch()}>Reintentar</Button>}
          >
            No se pudo cargar el historial.
          </Alert>
        )}
        {downloadError && (
          <Alert severity="error" onClose={() => setDownloadError(null)}>
            {downloadError}
          </Alert>
        )}
        {!jobs.isLoading && !jobs.isError && items.length === 0 && (
          <Paper className="empty-state" elevation={0}>
            <Box className="empty-state-icon">
              <ImageNotSupportedRounded />
            </Box>
            <Typography variant="h2">Aún no hay trabajos</Typography>
            <Typography color="text.secondary">
              Procesa una imagen y aparecerá aquí.
            </Typography>
          </Paper>
        )}
        <Box component="ul" className="history-grid">
          {items.map((job) => (
            <Paper
              component="li"
              key={job.id}
              className="history-card"
              elevation={0}
            >
              <HistoryThumbnail job={job} />
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "center" }}
              >
                <Typography variant="overline">
                  {toolLabels[job.tool]}
                </Typography>
                <Chip
                  label={historyStatus(job).label}
                  color={historyStatus(job).color}
                  size="small"
                />
              </Stack>
              <Box>
                <Typography variant="h2">
                  {displayedAsset(job).width} × {displayedAsset(job).height}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(job.created_at).toLocaleString("es")} ·{" "}
                  {job.credits} crédito{job.credits === 1 ? "" : "s"}
                </Typography>
              </Box>
              {hasAvailableResult(job) && (
                <Box className="history-card-footer">
                  <Box className="history-card-actions">
                    <Button
                      component={Link}
                      to={resultPath(job)}
                      endIcon={<ArrowOutwardRounded />}
                    >
                      Ver
                    </Button>
                    <Button
                      endIcon={<DownloadRounded />}
                      disabled={downloading === job.id}
                      onClick={() => void startDownload(job)}
                    >
                      {downloading === job.id ? "Descargando…" : "Descargar"}
                    </Button>
                  </Box>
                </Box>
              )}
            </Paper>
          ))}
        </Box>
        {jobs.hasNextPage && (
          <Button
            variant="outlined"
            disabled={jobs.isFetchingNextPage}
            onClick={() => void jobs.fetchNextPage()}
            sx={{ alignSelf: "center" }}
          >
            {jobs.isFetchingNextPage ? "Cargando…" : "Cargar más"}
          </Button>
        )}
      </Box>
    </StudioShell>
  );
}
