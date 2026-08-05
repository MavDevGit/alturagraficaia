import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Chip,
  Drawer,
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
import TollRounded from "@mui/icons-material/TollRounded";
import KeyboardArrowDownRounded from "@mui/icons-material/KeyboardArrowDownRounded";
import HelpOutlineRounded from "@mui/icons-material/HelpOutlineRounded";
import { NavLink, useLocation, useNavigate } from "react-router";
import { api, type CurrentUser } from "../api/client";
import { useAuth } from "../auth/context";
import { useColorMode } from "../theme/context";

const tools = [
  {
    to: "/studio/upscaler",
    label: "Escalador IA",
    shortLabel: "Escalar",
    icon: <ImageRounded />,
  },
  {
    to: "/studio/background-remover",
    label: "Quitar fondo",
    shortLabel: "Fondo",
    icon: <CollectionsRounded />,
  },
  {
    to: "/studio/outpainting",
    label: "Expandir lienzo",
    shortLabel: "Expandir",
    icon: <CropFreeRounded />,
  },
];

export function StudioShell({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const auth = useAuth();
  const color = useColorMode();
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<CurrentUser>("/me"),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [toolAnchor, setToolAnchor] = useState<HTMLElement | null>(null);
  const activeLabel =
    pathname === "/history"
      ? "Historial"
      : pathname === "/admin"
        ? "Administración"
        : tools.find((tool) => tool.to === pathname)?.label ?? "Estudio";
  const activeTool = tools.find((tool) => tool.to === pathname);
  return (
    <Box className="app-shell">
      <AppBar color="inherit" elevation={0} className="topbar">
        <Toolbar>
          <Box className="brand-mark compact" aria-hidden="true">A</Box>
          <Box className="brand-copy">
            <Typography sx={{ fontWeight: 780 }}>Altura Gráfica IA</Typography>
            <Typography variant="caption" color="text.secondary">
              Taller de Luz Digital
            </Typography>
          </Box>
          {pathname.startsWith("/studio/") ? (
            <>
              <Button
                className="tool-picker"
                color="inherit"
                endIcon={<KeyboardArrowDownRounded />}
                onClick={(event) => setToolAnchor(event.currentTarget)}
                aria-haspopup="menu"
                aria-expanded={Boolean(toolAnchor)}
              >
                {activeTool?.icon}
                <span className="tool-picker-label">{activeLabel}</span>
                <span className="tool-picker-short">{activeTool?.shortLabel}</span>
              </Button>
              <Menu
                anchorEl={toolAnchor}
                open={Boolean(toolAnchor)}
                onClose={() => setToolAnchor(null)}
                slotProps={{ paper: { className: "tool-picker-menu" } }}
              >
                {tools.map((tool) => (
                  <MenuItem
                    key={tool.to}
                    selected={pathname === tool.to}
                    onClick={() => {
                      setToolAnchor(null);
                      navigate(tool.to);
                    }}
                  >
                    {tool.icon} {tool.label}
                  </MenuItem>
                ))}
              </Menu>
            </>
          ) : (
            <Box className="topbar-section" aria-hidden="true">
              <span />
              <Typography variant="body2">{activeLabel}</Typography>
            </Box>
          )}
          <Box sx={{ flex: 1 }} />
          <Chip
            className="credit-chip"
            icon={<TollRounded />}
            label={
              <>
                <strong>{me?.credit_balance ?? "—"}</strong>{" "}
                <span className="credit-copy">créditos</span>
              </>
            }
          />
          <Tooltip title="Ayuda y documentación">
            <IconButton aria-label="Abrir ayuda">
              <HelpOutlineRounded />
            </IconButton>
          </Tooltip>
          <Tooltip
            title={color.mode === "light" ? "Modo oscuro" : "Modo claro"}
          >
            <IconButton
              onClick={color.toggle}
              aria-label={
                color.mode === "light"
                  ? "Activar modo oscuro"
                  : "Activar modo claro"
              }
            >
              {color.mode === "light" ? (
                <DarkModeRounded />
              ) : (
                <LightModeRounded />
              )}
            </IconButton>
          </Tooltip>
          <IconButton
            className="account-button"
            aria-label="Abrir menú de cuenta"
            aria-haspopup="menu"
            aria-expanded={Boolean(anchor)}
            onClick={(event) => setAnchor(event.currentTarget)}
          >
            <Avatar src={me?.avatar_url ?? undefined}>
              {me?.name?.[0] ?? "A"}
            </Avatar>
          </IconButton>
          <Menu
            anchorEl={anchor}
            open={Boolean(anchor)}
            onClose={() => setAnchor(null)}
            slotProps={{ paper: { className: "account-menu" } }}
          >
            <Box className="account-summary">
              <Typography variant="subtitle2">{me?.name ?? "Mi cuenta"}</Typography>
              <Typography variant="caption" color="text.secondary">
                {me?.email}
              </Typography>
            </Box>
            {me?.role === "admin" && (
              <MenuItem component={NavLink} to="/admin" onClick={() => setAnchor(null)}>
                <AdminPanelSettingsRounded fontSize="small" /> Administración
              </MenuItem>
            )}
            <MenuItem onClick={auth.logout}>
              <LogoutRounded fontSize="small" /> Cerrar sesión
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>
      <Drawer
        variant="permanent"
        className="tool-drawer"
        slotProps={{ paper: { component: "nav" } }}
      >
        <Toolbar />
        <List>
          {tools.map((tool) => (
            <ListItemButton
              key={tool.to}
              component={NavLink}
              to={tool.to}
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
        <Box className="drawer-signature" aria-hidden="true">
          <span />
        </Box>
      </Drawer>
      <Box component="main" className="shell-main">
        {children}
      </Box>
    </Box>
  );
}
