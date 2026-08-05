import { useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import DownloadRounded from "@mui/icons-material/DownloadRounded";
import ImageNotSupportedRounded from "@mui/icons-material/ImageNotSupportedRounded";
import AddPhotoAlternateRounded from "@mui/icons-material/AddPhotoAlternateRounded";
import ArrowOutwardRounded from "@mui/icons-material/ArrowOutwardRounded";
import { Link } from "react-router";
import { api, download, type Job, type ViewerSource } from "../api/client";
import { StudioShell } from "../components/StudioShell";

type JobsPage = {
  data: Job[];
  meta: { current_page: number; last_page: number; total: number };
};

const statusLabels: Record<Job["status"], string> = {
  queued: "En cola",
  processing: "Procesando",
  tiling: "Preparando visor",
  completed: "Completado",
  failed: "Fallido",
  cancelled: "Cancelado",
};

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
  const resultId = job.result_asset?.id;
  const viewer = useQuery({
    queryKey: ["history-viewer", resultId],
    queryFn: () => api<ViewerSource>(`/assets/${resultId}/viewer`),
    enabled: Boolean(resultId && job.status === "completed"),
    staleTime: 60_000,
  });
  const source = viewer.data;
  let thumbnail: string | null = null;
  if (source?.ready && source.max_level !== null) {
    const reduction = Math.max(
      0,
      Math.ceil(Math.log2(Math.max(source.width, source.height) / 512)),
    );
    const level = Math.max(0, source.max_level - reduction);
    thumbnail = source.tile_url
      .replace("{level}", String(level))
      .replace("{x}", "0")
      .replace("{y}", "0");
  }

  return (
    <Box className={`history-card-visual ${thumbnail ? "has-image" : ""}`}>
      {thumbnail ? (
        <img
          src={thumbnail}
          alt={`Resultado de ${toolLabels[job.tool]}`}
          loading="lazy"
        />
      ) : (
        <>
          <ImageNotSupportedRounded />
          <span>{displayedAsset(job).width}</span>
        </>
      )}
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
              Originales, resultados y mosaicos se eliminan automáticamente a
              los siete días.
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
        <Box className="history-grid">
          {items.map((job) => (
            <Paper key={job.id} className="history-card" elevation={0}>
              <HistoryThumbnail job={job} />
              <Stack
                direction="row"
                sx={{ justifyContent: "space-between", alignItems: "center" }}
              >
                <Typography variant="overline">
                  {toolLabels[job.tool]}
                </Typography>
                <Chip
                  label={statusLabels[job.status]}
                  color={
                    job.status === "completed"
                      ? "success"
                      : job.status === "failed"
                        ? "error"
                        : "default"
                  }
                  size="small"
                />
              </Stack>
              <Box>
                <Typography variant="h2">
                  {displayedAsset(job).width} × {displayedAsset(job).height}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {new Date(job.created_at).toLocaleString("es")}
                </Typography>
              </Box>
              <Box className="history-card-footer">
                <Typography variant="caption">
                  {job.credits} crédito{job.credits === 1 ? "" : "s"}
                </Typography>
                {job.result_asset && job.status === "completed" && (
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
                )}
              </Box>
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
