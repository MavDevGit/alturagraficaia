import { lazy, Suspense } from "react";
import { Alert, Box, Button, CircularProgress } from "@mui/material";
import { Navigate, Route, Routes } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "./auth/context";
import { api, type CurrentUser } from "./api/client";

const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const StudioPage = lazy(() =>
  import("./pages/StudioPage").then((module) => ({
    default: module.StudioPage,
  })),
);
const HistoryPage = lazy(() =>
  import("./pages/HistoryPage").then((module) => ({
    default: module.HistoryPage,
  })),
);
const AdminPage = lazy(() =>
  import("./pages/AdminPage").then((module) => ({ default: module.AdminPage })),
);

function Protected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <Box className="splash">
        <CircularProgress />
      </Box>
    );
  return user ? children : <Navigate to="/login" replace />;
}

function AdminProtected({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const me = useQuery({
    queryKey: ["me"],
    queryFn: () => api<CurrentUser>("/me"),
    enabled: Boolean(user),
    refetchOnMount: "always",
  });
  if (loading || (user && me.isPending))
    return (
      <Box className="splash">
        <CircularProgress />
      </Box>
    );
  if (!user) return <Navigate to="/login" replace />;
  if (me.isError)
    return (
      <Box className="splash">
        <Alert
          severity="error"
          action={<Button onClick={() => void me.refetch()}>Reintentar</Button>}
        >
          No se pudo verificar el acceso administrativo.
        </Alert>
      </Box>
    );
  return me.data?.role === "admin" ? (
    children
  ) : (
    <Navigate to="/studio/upscaler" replace />
  );
}

export function App() {
  return (
    <Suspense
      fallback={
        <Box className="splash">
          <CircularProgress />
        </Box>
      }
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/studio/upscaler" replace />} />
        <Route
          path="/studio/:tool"
          element={
            <Protected>
              <StudioPage />
            </Protected>
          }
        />
        <Route
          path="/history"
          element={
            <Protected>
              <HistoryPage />
            </Protected>
          }
        />
        <Route
          path="/admin"
          element={
            <AdminProtected>
              <AdminPage />
            </AdminProtected>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}
