import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Divider,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
import AutoAwesomeRounded from "@mui/icons-material/AutoAwesomeRounded";
import CheckCircleRounded from "@mui/icons-material/CheckCircleRounded";
import Google from "@mui/icons-material/Google";
import LockOutlined from "@mui/icons-material/LockOutlined";
import { Navigate } from "react-router";
import { useAuth } from "../auth/context";

export function LoginPage() {
  const auth = useAuth();
  const localMode = import.meta.env.VITE_AUTH_DRIVER === "local";
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  if (auth.user) return <Navigate to="/studio/upscaler" replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await (mode === "login"
        ? auth.login(email.trim(), password)
        : auth.register(email.trim(), password));
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!email.trim()) {
      setError("Escribe tu correo para enviar el enlace de recuperación.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await auth.reset(email.trim());
      setNotice("Si la cuenta existe, recibirás un enlace de recuperación.");
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  const googleLogin = async () => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await auth.loginGoogle();
    } catch (reason) {
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box className="login-page">
      <Box className="login-story">
        <Box className="login-brand">
          <Box className="brand-mark">
            <AutoAwesomeRounded />
          </Box>
          <Box>
            <Typography sx={{ fontWeight: 780 }}>Altura Gráfica IA</Typography>
            <Typography variant="caption">Taller de Luz Digital</Typography>
          </Box>
        </Box>
        <Box className="login-message">
          <Typography variant="overline">Precisión a escala real</Typography>
          <Typography variant="h1">
            Convierte cada píxel en una pieza lista para entregar.
          </Typography>
          <Typography className="login-copy">
            Mejora, recorta y expande imágenes en un flujo profesional. Revisa
            el resultado con mosaicos de alta resolución antes de descargar.
          </Typography>
        </Box>
        <Box className="login-lens" aria-label="Demostración de comparación antes y después">
          <Box className="lens-before">
            <span>Antes</span>
            <Box className="pixel-sample" />
          </Box>
          <Box className="lens-after">
            <span>Después</span>
            <Box className="detail-sample" />
          </Box>
          <Box className="lens-divider"><AutoAwesomeRounded /></Box>
        </Box>
        <Box className="login-proof">
          {[
            "Comparación a nivel de píxel",
            "Procesamiento seguro",
            "Historial durante 7 días",
          ].map((item) => (
            <Box key={item}>
              <CheckCircleRounded />
              <Typography variant="body2">{item}</Typography>
            </Box>
          ))}
        </Box>
      </Box>
      <Paper className="login-card" elevation={0}>
        <Box className="login-card-heading">
          <Typography variant="overline">Tu espacio creativo</Typography>
          <Typography variant="h2">
            {mode === "login" ? "Qué bueno tenerte de vuelta" : "Crea tu cuenta"}
          </Typography>
          <Typography color="text.secondary">
            {mode === "login"
              ? "Continúa donde dejaste tu último trabajo."
              : "Empieza a procesar imágenes en minutos."}
          </Typography>
        </Box>
        {localMode ? (
          <Stack spacing={2}>
            <Alert severity="info">
              Estás trabajando en el entorno local. No necesitas una cuenta de
              Google ni una contraseña.
            </Alert>
            <Button variant="contained" onClick={auth.loginLocal}>
              Ingresar al entorno local
            </Button>
          </Stack>
        ) : (
          <>
        <Tabs
          value={mode}
          onChange={(_, value) => {
            setMode(value);
            setError("");
            setNotice("");
          }}
          variant="fullWidth"
        >
          <Tab value="login" label="Ingresar" />
          <Tab value="register" label="Crear cuenta" />
        </Tabs>
        {error && <Alert severity="error">{error}</Alert>}
        {notice && <Alert severity="success">{notice}</Alert>}
        <Stack component="form" spacing={2} onSubmit={submit}>
          <TextField
            label="Correo electrónico"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          <TextField
            label="Contraseña"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={
              mode === "login" ? "current-password" : "new-password"
            }
            required
            slotProps={{ htmlInput: { minLength: mode === "login" ? 6 : 8 } }}
          />
          <Button variant="contained" type="submit" disabled={busy}>
            {busy
              ? "Conectando…"
              : mode === "login"
                ? "Ingresar"
                : "Crear cuenta"}
          </Button>
        </Stack>
        {mode === "login" && (
          <Button size="small" disabled={busy} onClick={resetPassword}>
            Olvidé mi contraseña
          </Button>
        )}
        <Divider>o continúa con</Divider>
        <Button
          variant="outlined"
          startIcon={<Google />}
          disabled={busy}
          onClick={googleLogin}
        >
          Google
        </Button>
          </>
        )}
        <Box className="login-security">
          <LockOutlined />
          <Typography variant="caption" color="text.secondary">
            {localMode
              ? "Acceso aislado para desarrollo en esta computadora."
              : "Autenticación protegida por Firebase. Nunca guardamos tu contraseña."}
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}

function authErrorMessage(reason: unknown): string {
  const code = (reason as { code?: string })?.code;
  const messages: Record<string, string> = {
    "auth/email-already-in-use":
      "Ese correo ya está registrado. Intenta ingresar.",
    "auth/invalid-credential": "El correo o la contraseña no son correctos.",
    "auth/user-not-found":
      "Esa cuenta no existe en el entorno local. Elige Crear cuenta primero.",
    "auth/wrong-password": "El correo o la contraseña no son correctos.",
    "auth/invalid-email": "El correo electrónico no tiene un formato válido.",
    "auth/network-request-failed":
      "No se pudo conectar con Firebase. Comprueba que el emulador esté iniciado.",
    "auth/operation-not-allowed":
      "Este método de acceso no está habilitado en Firebase.",
    "auth/popup-blocked":
      "El navegador bloqueó la ventana de Google. Permítela e intenta nuevamente.",
    "auth/popup-closed-by-user":
      "La ventana de Google se cerró antes de completar el acceso.",
    "auth/too-many-requests":
      "Demasiados intentos. Espera unos minutos antes de reintentar.",
    "auth/weak-password": "Usa una contraseña de al menos ocho caracteres.",
  };
  return (
    messages[code ?? ""] ??
    "No se pudo completar la autenticación. Intenta nuevamente."
  );
}
