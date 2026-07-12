"use client";

import { createContext, useContext, useMemo, useState } from "react";
import { CssBaseline, ThemeProvider, createTheme, type PaletteMode } from "@mui/material";

type ColorModeValue = {
  mode: PaletteMode;
  toggleColorMode: () => void;
};

const ColorModeContext = createContext<ColorModeValue>({
  mode: "light",
  toggleColorMode: () => undefined,
});

export function useColorMode() {
  return useContext(ColorModeContext);
}

export function AppThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<PaletteMode>("light");

  const contextValue = useMemo(
    () => ({
      mode,
      toggleColorMode: () => setMode((current) => (current === "light" ? "dark" : "light")),
    }),
    [mode],
  );

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: "#09a8e5", light: "#45c3cf", dark: "#0f2169", contrastText: "#ffffff" },
          secondary: { main: "#25c783", light: "#74ebd5", dark: "#15865a", contrastText: "#ffffff" },
          success: { main: "#25c783" },
          warning: { main: "#ff845b" },
          error: { main: "#dc2626" },
          info: { main: "#0076af" },
          background:
            mode === "light"
              ? { default: "#f5f8fd", paper: "#ffffff" }
              : { default: "#0a1227", paper: "#111a31" },
        },
        shape: { borderRadius: 8 },
        typography: {
          fontFamily: "var(--font-geist-sans), Arial, sans-serif",
          h1: { letterSpacing: 0, fontWeight: 760 },
          h2: { letterSpacing: 0, fontWeight: 740 },
          h3: { letterSpacing: 0, fontWeight: 730 },
          h4: { letterSpacing: 0, fontWeight: 720 },
          h5: { letterSpacing: 0, fontWeight: 700 },
          h6: { letterSpacing: 0, fontWeight: 700 },
          button: { textTransform: "none", fontWeight: 700 },
        },
        components: {
          MuiPaper: {
            styleOverrides: {
              root: {
                backgroundImage: "none",
                borderColor: mode === "light" ? "rgba(15, 33, 105, 0.10)" : "rgba(255, 255, 255, 0.09)",
              },
            },
          },
          MuiButton: {
            defaultProps: { disableElevation: true },
            styleOverrides: { root: { minHeight: 40 } },
          },
          MuiChip: {
            styleOverrides: {
              root: { fontWeight: 700 },
            },
          },
        },
      }),
    [mode],
  );

  return (
    <ColorModeContext.Provider value={contextValue}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
