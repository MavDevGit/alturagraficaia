import { useEffect, useMemo, useState, type PropsWithChildren } from "react";

import { ModeContext, type ColorMode } from "./context";

const storageKey = "altura.theme";

function storedMode(): ColorMode {
  if (typeof window === "undefined") return "dark";
  try {
    const value = window.localStorage.getItem(storageKey);
    return value === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

function applyMode(mode: ColorMode) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(mode);
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
}

export function ColorModeProvider({ children }: PropsWithChildren) {
  const [mode, setMode] = useState<ColorMode>(storedMode);

  useEffect(() => {
    applyMode(mode);
    try {
      window.localStorage.setItem(storageKey, mode);
    } catch {
      // The visual preference still applies when storage is unavailable.
    }
  }, [mode]);

  const context = useMemo(
    () => ({
      mode,
      toggle: () =>
        setMode((current) => (current === "light" ? "dark" : "light")),
    }),
    [mode],
  );

  return (
    <ModeContext.Provider value={context}>{children}</ModeContext.Provider>
  );
}
