import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AppBar,
  Box,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import CollectionsRounded from "@mui/icons-material/CollectionsRounded";
import CropFreeRounded from "@mui/icons-material/CropFreeRounded";
import HistoryRounded from "@mui/icons-material/HistoryRounded";
import ImageRounded from "@mui/icons-material/ImageRounded";
import LightModeRounded from "@mui/icons-material/LightModeRounded";
import DarkModeRounded from "@mui/icons-material/DarkModeRounded";
import AdminPanelSettingsRounded from "@mui/icons-material/AdminPanelSettingsRounded";
import LogoutRounded from "@mui/icons-material/LogoutRounded";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import { NavLink, useLocation } from "react-router";
import { api, type CurrentUser } from "../api/client";
import { useAuth } from "../auth/context";
import { useColorMode } from "../theme/context";

const tools = [
  {
    to: "/studio/upscaler",
    label: "Escalador",
    accessibleLabel: "Escalador IA",
    icon: <ImageRounded />,
  },
  {
    to: "/studio/background-remover",
    label: "Quitar fondo",
    accessibleLabel: "Quitar fondo",
    icon: <CollectionsRounded />,
  },
  {
    to: "/studio/outpainting",
    label: "Expandir",
    accessibleLabel: "Expandir lienzo",
    icon: <CropFreeRounded />,
  },
];

export function StudioShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const auth = useAuth();
  const color = useColorMode();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<CurrentUser>("/me"),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <Box className="app-shell">
      <AppBar
        component="header"
        position="static"
        color="inherit"
        elevation={0}
        className="topbar"
      >
        <Toolbar>
          <Box className="brand-lockup">
            <Box className="brand-mark compact" aria-hidden="true">
              A
            </Box>
            <Box className="brand-copy">
              <Typography>Altura Gráfica IA</Typography>
              <Typography variant="caption" color="text.secondary">
                Taller de Luz Digital
              </Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1 }} />
          <Typography className="credit-pill" variant="caption">
            {me?.credit_balance ?? "—"} créditos
          </Typography>
          <Tooltip title="Ayuda y opciones">
            <IconButton
              aria-label="Ayuda"
              aria-haspopup="menu"
              aria-expanded={Boolean(anchor)}
              onClick={(event) => setAnchor(event.currentTarget)}
            >
              <HelpOutlineRounded />
            </IconButton>
          </Tooltip>
          <Menu
            anchorEl={anchor}
            open={Boolean(anchor)}
            onClose={() => setAnchor(null)}
            slotProps={{ paper: { className: "account-menu" } }}
          >
            <Box className="account-summary">
              <Typography variant="subtitle2">
                {me?.name ?? "Mi cuenta"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {me?.email}
              </Typography>
            </Box>
            <MenuItem
              onClick={() => {
                color.toggle();
                setAnchor(null);
              }}
            >
              {color.mode === "light" ? (
                <DarkModeRounded fontSize="small" />
              ) : (
                <LightModeRounded fontSize="small" />
              )}
              {color.mode === "light" ? "Modo oscuro" : "Modo claro"}
            </MenuItem>
            {me?.role === "admin" && (
              <MenuItem
                component={NavLink}
                to="/admin"
                onClick={() => setAnchor(null)}
              >
                <AdminPanelSettingsRounded fontSize="small" /> Administración
              </MenuItem>
            )}
            <MenuItem onClick={auth.logout}>
              <LogoutRounded fontSize="small" /> Cerrar sesión
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      <Box className="shell-body">
        <Box
          component="nav"
          className="tool-navigation"
          aria-label="Herramientas"
        >
          <List>
            {tools.map((tool) => (
              <ListItemButton
                key={tool.to}
                component={NavLink}
                to={tool.to}
                aria-label={tool.accessibleLabel}
                selected={pathname === tool.to}
              >
                <ListItemIcon>{tool.icon}</ListItemIcon>
                <ListItemText primary={tool.label} />
              </ListItemButton>
            ))}
            <ListItemButton
              component={NavLink}
              to="/history"
              selected={pathname === "/history"}
            >
              <ListItemIcon>
                <HistoryRounded />
              </ListItemIcon>
              <ListItemText primary="Historial" />
            </ListItemButton>
          </List>
        </Box>

        <Box component="main" className="shell-main">
          {children}
        </Box>
      </Box>
    </Box>
  );
}
