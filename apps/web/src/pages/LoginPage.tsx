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
} from "../components/ui";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { GoogleIcon as Google } from "../components/ui/GoogleIcon";
import { Link, Navigate } from "react-router";
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
    auth.clearAuthError();
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
    auth.clearAuthError();
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
    auth.clearAuthError();
    try {
      await auth.loginGoogle();
    } catch (reason) {
      console.error("Google authentication failed", reason);
      setError(authErrorMessage(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box className="login-page">
      <Box className="login-grid-bg" aria-hidden="true" />
      <Box className="login-glow login-glow-primary" aria-hidden="true" />
      <Box className="login-glow login-glow-secondary" aria-hidden="true" />

      <Box component="header" className="login-header">
        <Box className="login-header-inner">
          <Link className="login-brand" to="/" aria-label="Altura Gráfica IA">
            <span className="reference-brand-mark">A</span>
            <span>Altura Gráfica IA</span>
          </Link>
          <Link className="login-back" to="/">
            <ArrowLeft aria-hidden="true" /> Volver al inicio
          </Link>
        </Box>
      </Box>

      <Box component="main" className="login-main">
        <Paper className="login-card" elevation={0}>
          <Box className="login-card-heading">
            <Typography variant="h2">
              {mode === "login" ? "Accede a tu estudio" : "Crea tu cuenta"}
            </Typography>
            <Typography color="text.secondary">
              {mode === "login"
                ? "Continúa con tus proyectos y resultados."
                : "Configura tu acceso en menos de un minuto."}
            </Typography>
          </Box>
          {localMode ? (
            <Stack spacing={2}>
              <Alert severity="info">Estás trabajando en el entorno local. No necesitas una cuenta de Google ni una contraseña.</Alert>
              <Button variant="contained" onClick={auth.loginLocal}>Ingresar al entorno local</Button>
            </Stack>
          ) : (
            <>
              <Tabs
                value={mode}
                onChange={(_, value) => {
                  setMode(value);
                  setError("");
                  setNotice("");
                  auth.clearAuthError();
                }}
                variant="fullWidth"
              >
                <Tab value="login" label="Ingresar" />
                <Tab value="register" label="Crear cuenta" />
              </Tabs>
              {(error || auth.authError) && <Alert severity="error">{error || auth.authError}</Alert>}
              {notice && <Alert severity="success">{notice}</Alert>}
              <Stack component="form" spacing={2} onSubmit={submit}>
                <TextField label="Correo electrónico" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required />
                <TextField
                  label="Contraseña"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  required
                  slotProps={{ htmlInput: { minLength: mode === "login" ? 6 : 8 } }}
                />
                <Button variant="contained" type="submit" disabled={busy}>
                  {busy ? "Conectando…" : mode === "login" ? "Ingresar" : "Crear cuenta"}
                </Button>
              </Stack>
              {mode === "login" && <Button className="login-reset" size="small" disabled={busy} onClick={resetPassword}>Olvidé mi contraseña</Button>}
              <Divider>o continúa con</Divider>
              <Button variant="outlined" startIcon={<Google />} disabled={busy} onClick={googleLogin}>Continuar con Google</Button>
            </>
          )}
          <Box className="login-security">
            <LockKeyhole aria-hidden="true" />
            <Typography variant="caption" color="text.secondary">
              {localMode ? "Acceso aislado para desarrollo en esta computadora." : "Autenticación protegida por Firebase. Nunca guardamos tu contraseña."}
            </Typography>
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}

function authErrorMessage(reason: unknown): string {
  const apiError = reason as { status?: number; message?: string };
  if (apiError?.status === 401) {
    return `Firebase aceptó la cuenta, pero la API no pudo validarla: ${apiError.message ?? "token rechazado"}`;
  }
  const code = (reason as { code?: string })?.code;
  const messages: Record<string, string> = {
    "auth/email-already-in-use": "Ese correo ya está registrado. Intenta ingresar.",
    "auth/invalid-credential": "El correo o la contraseña no son correctos.",
    "auth/user-not-found": "Esa cuenta no existe en el entorno local. Elige Crear cuenta primero.",
    "auth/wrong-password": "El correo o la contraseña no son correctos.",
    "auth/invalid-email": "El correo electrónico no tiene un formato válido.",
    "auth/network-request-failed": "No se pudo conectar con Firebase. Comprueba tu conexión e intenta nuevamente.",
    "auth/operation-not-allowed": "Este método de acceso no está habilitado en Firebase.",
    "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase Authentication.",
    "auth/popup-blocked": "El navegador bloqueó la ventana de Google. Permítela e intenta nuevamente.",
    "auth/popup-closed-by-user": "La ventana de Google se cerró antes de completar el acceso.",
    "auth/internal-error": "Google no pudo iniciar la autenticación. Actualiza la página e intenta nuevamente.",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos antes de reintentar.",
    "auth/weak-password": "Usa una contraseña de al menos ocho caracteres.",
  };
  return messages[code ?? ""] ?? (code ? `No se pudo completar la autenticación (${code}). Intenta nuevamente.` : "No se pudo completar la autenticación. Intenta nuevamente.");
}
