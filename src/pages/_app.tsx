import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import { theme } from "@/styles/theme";
import Navigation from "@/components/layout/Navigation";
import { useBackgroundJobTrigger } from "@/hooks/useBackgroundJobTrigger";

/**
 * Root application component
 * Wraps all pages with:
 * - MUI ThemeProvider (with Vietnamese locale)
 * - CssBaseline for consistent styling
 * - Navigation component
 * - Background job auto-trigger (every 5 minutes)
 */
export default function App({ Component, pageProps }: AppProps) {
  // Auto-trigger background AI classification job every 5 minutes
  useBackgroundJobTrigger(5);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box
        sx={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}
      >
        <Navigation />
        <Box component="main" sx={{ flexGrow: 1, py: 3 }}>
          <Component {...pageProps} />
        </Box>
      </Box>
    </ThemeProvider>
  );
}
