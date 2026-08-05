import {
  Component,
  useEffect,
  useState,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { Alert, Box, Button, Typography } from "@mui/material";

export class AppBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Error no controlado en la interfaz", error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <Box className="fatal-state" role="alert">
        <Typography variant="h1">La interfaz necesita reiniciarse</Typography>
        <Typography color="text.secondary">
          Tus archivos procesados permanecen en el historial. Recarga la
          aplicación para continuar.
        </Typography>
        <Button variant="contained" onClick={() => window.location.reload()}>
          Recargar aplicación
        </Button>
      </Box>
    );
  }
}

export function NetworkStatus() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const connected = () => setOnline(true);
    const disconnected = () => setOnline(false);
    window.addEventListener("online", connected);
    window.addEventListener("offline", disconnected);
    return () => {
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", disconnected);
    };
  }, []);
  if (online) return null;
  return (
    <Alert className="offline-notice" severity="warning" role="status">
      Sin conexión. Conservaremos esta pantalla y podrás reintentar cuando
      vuelva la red.
    </Alert>
  );
}
