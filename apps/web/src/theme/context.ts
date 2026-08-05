import { createContext, useContext } from "react";

export type ColorMode = "light" | "dark";
export const ModeContext = createContext({
  mode: "light" as ColorMode,
  toggle: () => {},
});
export const useColorMode = () => useContext(ModeContext);
