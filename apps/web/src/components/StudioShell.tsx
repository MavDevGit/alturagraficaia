import { useQuery } from "@tanstack/react-query";
import {
  CircleHelp,
  Coins,
  Expand,
  History,
  Images,
  ImageUpscale,
  LogOut,
  Moon,
  ShieldCheck,
  Sparkles,
  Sun,
} from "lucide-react";
import { NavLink, useLocation } from "react-router";
import { api, type CurrentUser } from "../api/client";
import { useAuth } from "../auth/context";
import { useColorMode } from "../theme/context";
import { cn } from "../lib/cn";
import { DropdownMenu, IconButton, Tooltip } from "./ui";

const tools = [
  {
    to: "/studio/upscaler",
    label: "Escalador",
    accessibleLabel: "Escalador IA",
    icon: ImageUpscale,
  },
  {
    to: "/studio/background-remover",
    label: "Quitar fondo",
    accessibleLabel: "Quitar fondo",
    icon: Images,
  },
  {
    to: "/studio/outpainting",
    label: "Expandir",
    accessibleLabel: "Expandir lienzo",
    icon: Expand,
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <span className="brand-mark compact" aria-hidden="true">
            <Sparkles />
          </span>
          <div className="brand-copy">
            <strong>Altura Gráfica IA</strong>
            <span>Taller de Luz Digital</span>
          </div>
        </div>
        <span className="credit-pill">
          <Coins aria-hidden="true" /> {me?.credit_balance ?? "—"} créditos
        </span>
        <DropdownMenu.Root>
          <Tooltip title="Ayuda y opciones">
            <DropdownMenu.Trigger asChild>
              <IconButton aria-label="Ayuda" aria-haspopup="menu">
                <CircleHelp aria-hidden="true" />
              </IconButton>
            </DropdownMenu.Trigger>
          </Tooltip>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={8}
              className="account-menu"
            >
              <div className="account-summary">
                <strong>{me?.name ?? "Mi cuenta"}</strong>
                <span>{me?.email}</span>
              </div>
              <DropdownMenu.Separator className="menu-separator" />
              <DropdownMenu.Item className="menu-item" onSelect={color.toggle}>
                {color.mode === "light" ? <Moon /> : <Sun />}
                {color.mode === "light" ? "Modo oscuro" : "Modo claro"}
              </DropdownMenu.Item>
              {me?.role === "admin" && (
                <DropdownMenu.Item asChild>
                  <NavLink className="menu-item" to="/admin">
                    <ShieldCheck /> Administración
                  </NavLink>
                </DropdownMenu.Item>
              )}
              <DropdownMenu.Item className="menu-item" onSelect={auth.logout}>
                <LogOut /> Cerrar sesión
              </DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      </header>

      <div className="shell-body">
        <nav className="tool-navigation" aria-label="Herramientas">
          <ul>
            {tools.map((tool) => {
              const Icon = tool.icon;
              const active = pathname === tool.to;
              return (
                <li key={tool.to}>
                  <NavLink
                    to={tool.to}
                    aria-label={tool.accessibleLabel}
                    aria-current={active ? "page" : undefined}
                    className={cn("tool-link", active && "is-active")}
                  >
                    <Icon aria-hidden="true" />
                    <span>{tool.label}</span>
                  </NavLink>
                </li>
              );
            })}
            <li>
              <NavLink
                to="/history"
                aria-current={pathname === "/history" ? "page" : undefined}
                className={cn(
                  "tool-link",
                  pathname === "/history" && "is-active",
                )}
              >
                <History aria-hidden="true" />
                <span>Historial</span>
              </NavLink>
            </li>
          </ul>
        </nav>

        <main className="shell-main">{children}</main>
      </div>
    </div>
  );
}
