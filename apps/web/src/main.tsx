import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router";
import { AuthProvider } from "./auth/AuthProvider";
import { ColorModeProvider } from "./theme/ColorModeProvider";
import { App } from "./App";
import { AppBoundary, NetworkStatus } from "./components/AppBoundary";
import "@fontsource-variable/plus-jakarta-sans";
import "./styles.css";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ColorModeProvider>
          <AuthProvider>
            <AppBoundary>
              <NetworkStatus />
              <App />
            </AppBoundary>
          </AuthProvider>
        </ColorModeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
);
