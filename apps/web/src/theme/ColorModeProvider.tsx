import { useMemo, useState, type PropsWithChildren } from "react";
import { CssBaseline, ThemeProvider, alpha, createTheme } from "@mui/material";

import { ModeContext, type ColorMode } from "./context";

const emerald = {
  50: "#E8FBF4",
  100: "#C6F4E4",
  200: "#8CE6C9",
  300: "#4DD6AD",
  400: "#1FC796",
  500: "#0DBB84",
  600: "#08966B",
  700: "#087658",
  800: "#075E49",
  900: "#064D3D",
};

export function ColorModeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<ColorMode>(
    () => (localStorage.getItem("altura.theme") as ColorMode) || "light",
  );
  const context = useMemo(
    () => ({
      mode,
      toggle: () =>
        setMode((current) => {
          const next = current === "light" ? "dark" : "light";
          localStorage.setItem("altura.theme", next);
          return next;
        }),
    }),
    [mode],
  );
  const theme = useMemo(() => {
    const light = mode === "light";
    const ink = light ? "#26322D" : "#F1F7F4";
    const paper = light ? "#FFFFFF" : "#101A17";
    const canvas = light ? "#FBFDFC" : "#07100D";
    const divider = light ? "#E4E9E6" : "#24342E";
    const accent = light ? "#378267" : emerald[400];

    return createTheme({
      colorSchemes: {
        [mode]: {
          palette: {
            mode,
            primary: {
              main: accent,
              light: emerald[300],
              dark: emerald[700],
              contrastText: light ? "#FFFFFF" : "#042D21",
            },
            secondary: {
              main: light ? "#A66A2B" : "#E1AD70",
              contrastText: light ? "#FFFFFF" : "#231407",
            },
            success: { main: light ? "#087658" : "#36C99B" },
            warning: { main: light ? "#A96B12" : "#F4B95E" },
            error: { main: light ? "#BA3D4B" : "#F07B87" },
            info: { main: light ? "#276E9E" : "#65B7EB" },
            background: { default: canvas, paper },
            text: {
              primary: ink,
              secondary: light ? "#66736D" : "#A7B8B0",
            },
            divider,
            action: {
              hover: alpha(accent, light ? 0.07 : 0.11),
              selected: alpha(accent, light ? 0.12 : 0.16),
              disabledBackground: light ? "#E7ECE9" : "#1B2823",
              disabled: light ? "#98A49E" : "#697A72",
            },
          },
        },
      },
      cssVariables: { colorSchemeSelector: "class" },
      shape: { borderRadius: 8 },
      typography: {
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        h1: {
          fontSize: "clamp(2rem, 4vw, 3.5rem)",
          lineHeight: 1.02,
          fontWeight: 760,
          letterSpacing: "-0.035em",
        },
        h2: {
          fontSize: "1.2rem",
          lineHeight: 1.25,
          fontWeight: 740,
          letterSpacing: "-0.018em",
        },
        h3: {
          fontSize: "1rem",
          lineHeight: 1.35,
          fontWeight: 720,
          letterSpacing: "-0.012em",
        },
        subtitle1: { fontWeight: 680, letterSpacing: "-0.01em" },
        body1: { lineHeight: 1.6 },
        body2: { lineHeight: 1.55 },
        overline: {
          fontSize: "0.68rem",
          lineHeight: 1.4,
          fontWeight: 800,
          letterSpacing: "0.11em",
        },
        button: {
          textTransform: "none",
          fontWeight: 720,
          letterSpacing: "-0.01em",
        },
        caption: { lineHeight: 1.45 },
      },
      components: {
        MuiCssBaseline: {
          styleOverrides: {
            body: {
              backgroundColor: canvas,
              color: ink,
              transition: "background-color 180ms ease, color 180ms ease",
            },
            "::selection": {
              backgroundColor: alpha(accent, 0.26),
            },
            "*:focus-visible": {
              outline: `3px solid ${alpha(accent, 0.34)}`,
              outlineOffset: 2,
            },
          },
        },
        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: {
              minHeight: 44,
              borderRadius: 6,
              paddingInline: 16,
              boxShadow: "none",
              transition:
                "background-color 160ms ease, border-color 160ms ease, transform 160ms ease, box-shadow 160ms ease",
              "&:active": { transform: "translateY(1px)" },
            },
            contained: {
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.10)",
              "&:hover": {
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.14)",
              },
            },
            outlined: { borderColor: divider },
          },
        },
        MuiIconButton: {
          styleOverrides: {
            root: {
              width: 44,
              height: 44,
              borderRadius: 6,
              transition: "background-color 160ms ease, color 160ms ease",
            },
          },
        },
        MuiPaper: {
          styleOverrides: { root: { backgroundImage: "none" } },
        },
        MuiOutlinedInput: {
          styleOverrides: {
            root: {
              minHeight: 44,
              borderRadius: 6,
              backgroundColor: light ? "#FBFCFB" : "#0C1512",
              "& .MuiOutlinedInput-notchedOutline": { borderColor: divider },
              "&:hover .MuiOutlinedInput-notchedOutline": {
                borderColor: light ? "#AFC0B8" : "#476057",
              },
              "&.Mui-focused": {
                boxShadow: `0 0 0 3px ${alpha(accent, 0.12)}`,
              },
            },
          },
        },
        MuiTabs: {
          styleOverrides: {
            root: { minHeight: 48 },
            indicator: { height: 3, borderRadius: "3px 3px 0 0" },
          },
        },
        MuiTab: {
          styleOverrides: {
            root: {
              minHeight: 48,
              textTransform: "none",
              fontWeight: 700,
            },
          },
        },
        MuiToggleButton: {
          styleOverrides: {
            root: {
              minHeight: 44,
              borderColor: divider,
              textTransform: "none",
              fontWeight: 700,
              "&.Mui-selected": {
                color: accent,
                backgroundColor: alpha(accent, light ? 0.1 : 0.15),
              },
            },
          },
        },
        MuiChip: {
          styleOverrides: {
            root: { fontWeight: 700, borderRadius: 9 },
            sizeSmall: { height: 28 },
          },
        },
        MuiAlert: {
          styleOverrides: {
            root: { borderRadius: 12, alignItems: "center" },
          },
        },
        MuiDialog: {
          styleOverrides: {
            paper: {
              borderRadius: 18,
              border: `1px solid ${divider}`,
              boxShadow: light
                ? "0 28px 80px rgba(24, 42, 34, 0.22)"
                : "0 28px 80px rgba(0, 0, 0, 0.48)",
            },
          },
        },
        MuiTooltip: {
          defaultProps: { arrow: true, enterDelay: 500 },
          styleOverrides: {
            tooltip: { borderRadius: 8, fontWeight: 650 },
          },
        },
        MuiTableCell: {
          styleOverrides: {
            head: {
              color: light ? "#53645C" : "#A7B8B0",
              fontSize: "0.74rem",
              fontWeight: 800,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            },
          },
        },
      },
    });
  }, [mode]);

  return (
    <ModeContext.Provider value={context}>
      <ThemeProvider theme={theme} defaultMode={mode}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ModeContext.Provider>
  );
}
