import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Paper,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AddCardRounded from "@mui/icons-material/AddCardRounded";
import KeyRounded from "@mui/icons-material/KeyRounded";
import PeopleAltRounded from "@mui/icons-material/PeopleAltRounded";
import MemoryRounded from "@mui/icons-material/MemoryRounded";
import DataUsageRounded from "@mui/icons-material/DataUsageRounded";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import { api, type CurrentUser } from "../api/client";
import { StudioShell } from "../components/StudioShell";

type AdminUser = CurrentUser & { last_login_at: string | null };
type Secret = { name: string; configured: boolean; rotated_at: string | null };
type ModelSetting = {
  id: number;
  tool: string;
  model: string;
  enabled: boolean;
  base_credits: number;
};
type UsageQuota = {
  id: number;
  resource: string;
  used: number;
  soft_limit: number;
  hard_limit: number;
};

function QueryState({
  loading,
  error,
  retry,
}: {
  loading: boolean;
  error: boolean;
  retry: () => void;
}) {
  if (loading) return <CircularProgress aria-label="Cargando datos" />;
  if (!error) return null;
  return (
    <Alert
      severity="error"
      action={<Button onClick={retry}>Reintentar</Button>}
    >
      No se pudo cargar esta sección.
    </Alert>
  );
}

export function AdminPage() {
  const [tab, setTab] = useState(0);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [amount, setAmount] = useState(10);
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const queryClient = useQueryClient();
  const users = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api<{ data: AdminUser[] }>("/admin/users"),
    enabled: tab === 0,
  });
  const models = useQuery({
    queryKey: ["admin-models"],
    queryFn: () => api<{ data: ModelSetting[] }>("/admin/models"),
    enabled: tab === 1,
  });
  const secrets = useQuery({
    queryKey: ["admin-secrets"],
    queryFn: () => api<{ data: Secret[] }>("/admin/secrets/status"),
    enabled: tab === 2,
  });
  const quotas = useQuery({
    queryKey: ["admin-quotas"],
    queryFn: () => api<{ data: UsageQuota[] }>("/admin/quotas"),
    enabled: tab === 3,
  });
  const adjust = useMutation({
    mutationFn: () =>
      api(`/admin/users/${selected!.id}/credits`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          reason: "Ajuste desde administración PWA",
          idempotency_key: idempotencyKey,
        }),
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      closeEditor();
    },
  });
  const updateModel = useMutation({
    mutationFn: (model: ModelSetting) =>
      api(`/admin/models/${model.id}`, {
        method: "PUT",
        body: JSON.stringify({ enabled: !model.enabled }),
      }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["admin-models"] }),
  });

  const openEditor = (user: AdminUser) => {
    setSelected(user);
    setAmount(10);
    setIdempotencyKey(crypto.randomUUID());
    adjust.reset();
  };
  const closeEditor = () => {
    setSelected(null);
    setIdempotencyKey("");
    adjust.reset();
  };
  const amountIsValid = Number.isInteger(amount) && amount !== 0;

  return (
    <StudioShell>
      <Box className="content-page admin-page">
        <Box className="page-heading admin-heading">
          <Box>
            <Typography variant="overline">Centro de control</Typography>
            <Typography variant="h1">Administración</Typography>
            <Typography color="text.secondary">
              Usuarios, modelos y estado seguro de integraciones.
            </Typography>
          </Box>
          <Chip
            className="admin-access-chip"
            icon={<AdminPanelSettingsRounded />}
            label="Acceso administrador"
            color="primary"
          />
        </Box>
        <Tabs
          className="admin-tabs"
          value={tab}
          onChange={(_, value) => setTab(value)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Secciones de administración"
        >
          <Tab icon={<PeopleAltRounded />} iconPosition="start" label="Usuarios" />
          <Tab icon={<MemoryRounded />} iconPosition="start" label="Modelos" />
          <Tab icon={<KeyRounded />} iconPosition="start" label="Secretos" />
          <Tab icon={<DataUsageRounded />} iconPosition="start" label="Cuotas" />
        </Tabs>
        {tab === 0 && (
          <>
            <QueryState
              loading={users.isLoading}
              error={users.isError}
              retry={() => void users.refetch()}
            />
            {users.data?.data.length === 0 && (
              <Alert severity="info">No hay usuarios registrados.</Alert>
            )}
            {users.data && users.data.data.length > 0 && (
              <Paper className="admin-table" elevation={0}>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Usuario</TableCell>
                      <TableCell>Rol</TableCell>
                      <TableCell align="right">Créditos</TableCell>
                      <TableCell align="right">Acciones</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {users.data.data.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>
                          <strong>{user.name ?? "Sin nombre"}</strong>
                          <br />
                          <Typography variant="caption" color="text.secondary">
                            {user.email}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={
                              user.role === "admin"
                                ? "Administrador"
                                : "Usuario"
                            }
                            color={
                              user.role === "admin" ? "primary" : "default"
                            }
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="right">
                          {user.credit_balance}
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            startIcon={<AddCardRounded />}
                            onClick={() => openEditor(user)}
                          >
                            Ajustar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            )}
          </>
        )}
        {tab === 1 && (
          <>
            <QueryState
              loading={models.isLoading}
              error={models.isError}
              retry={() => void models.refetch()}
            />
            <Box className="history-grid">
              {models.data?.data.map((model) => (
                <Paper key={model.tool} className="history-card admin-resource-card" elevation={0}>
                  <Chip
                    label={model.enabled ? "Activo" : "Inactivo"}
                    color={model.enabled ? "success" : "default"}
                    size="small"
                  />
                  <Typography variant="h2">{model.tool}</Typography>
                  <Typography color="text.secondary">{model.model}</Typography>
                  <Button
                    color={model.enabled ? "warning" : "success"}
                    disabled={updateModel.isPending}
                    onClick={() => updateModel.mutate(model)}
                  >
                    {model.enabled ? "Desactivar" : "Activar"}
                  </Button>
                  <Typography>{model.base_credits} créditos base</Typography>
                </Paper>
              ))}
            </Box>
            {updateModel.isError && (
              <Alert severity="error" onClose={() => updateModel.reset()}>
                No se pudo actualizar el modelo.
              </Alert>
            )}
          </>
        )}
        {tab === 2 && (
          <>
            <QueryState
              loading={secrets.isLoading}
              error={secrets.isError}
              retry={() => void secrets.refetch()}
            />
            <Alert severity="info" sx={{ mb: 2 }}>
              La clave de FAL nunca se escribe ni se muestra en este panel. En
              producción se carga de forma segura en Google Secret Manager con
              <code> infra/gcp/set-fal-key.ps1</code>.
            </Alert>
            <Stack sx={{ gap: 2 }}>
              {secrets.data?.data.map((secret) => (
                <Paper key={secret.name} className="secret-row" elevation={0}>
                  <KeyRounded />
                  <Box>
                    <Typography sx={{ fontWeight: 700 }}>
                      {secret.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {secret.rotated_at
                        ? `Rotada: ${new Date(secret.rotated_at).toLocaleDateString("es")}`
                        : "Sin fecha de rotación registrada"}
                    </Typography>
                  </Box>
                  <Chip
                    label={secret.configured ? "Configurado" : "Pendiente"}
                    color={secret.configured ? "success" : "warning"}
                  />
                </Paper>
              ))}
            </Stack>
          </>
        )}
        {tab === 3 && (
          <>
            <QueryState
              loading={quotas.isLoading}
              error={quotas.isError}
              retry={() => void quotas.refetch()}
            />
            <Box className="history-grid">
              {quotas.data?.data.map((quota) => {
                const percentage = Math.min(
                  100,
                  (quota.used / Math.max(1, quota.hard_limit)) * 100,
                );
                return (
                  <Paper
                    key={quota.resource}
                    className="history-card admin-resource-card"
                    elevation={0}
                  >
                    <Chip
                      label={
                        quota.used >= quota.soft_limit
                          ? "Umbral preventivo"
                          : "Dentro del límite"
                      }
                      color={
                        quota.used >= quota.soft_limit ? "warning" : "success"
                      }
                      size="small"
                    />
                    <Typography variant="h2">{quota.resource}</Typography>
                    <LinearProgress
                      variant="determinate"
                      value={percentage}
                      aria-label={`Uso de ${quota.resource}`}
                    />
                    <Typography color="text.secondary">
                      {quota.used.toLocaleString("es")} de{" "}
                      {quota.hard_limit.toLocaleString("es")}
                    </Typography>
                  </Paper>
                );
              })}
            </Box>
          </>
        )}
        <Dialog
          open={selected !== null}
          onClose={closeEditor}
          fullWidth
          maxWidth="xs"
        >
          <DialogTitle>Ajustar créditos</DialogTitle>
          <DialogContent>
            <Stack sx={{ gap: 2, pt: 1 }}>
              <Typography>{selected?.email}</Typography>
              <TextField
                autoFocus
                label="Cantidad"
                type="number"
                value={amount}
                error={!amountIsValid}
                helperText={
                  amountIsValid
                    ? "Use un número negativo para descontar."
                    : "Ingrese un número entero distinto de cero."
                }
                slotProps={{
                  htmlInput: { step: 1, min: -100000, max: 100000 },
                }}
                onChange={(event) => setAmount(Number(event.target.value))}
              />
              {adjust.isError && (
                <Alert severity="error">
                  {adjust.error instanceof Error
                    ? adjust.error.message
                    : "No se pudo aplicar el ajuste."}
                </Alert>
              )}
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeEditor} disabled={adjust.isPending}>
              Cancelar
            </Button>
            <Button
              variant="contained"
              disabled={!amountIsValid || adjust.isPending}
              onClick={() => adjust.mutate()}
            >
              {adjust.isPending ? "Aplicando…" : "Aplicar ajuste"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </StudioShell>
  );
}
