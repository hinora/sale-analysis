import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { ThemeProvider, CssBaseline, Box } from '@mui/material';
import { theme } from '@/styles/theme';
import Navigation from '@/components/layout/Navigation';

/**
 * Root application component
 * Wraps all pages with:
 * - MUI ThemeProvider (with Vietnamese locale)
 * - CssBaseline for consistent styling
 * - Navigation component
 */
export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navigation />
        <Box component="main" sx={{ flexGrow: 1, py: 3 }}>
          <Component {...pageProps} />
        </Box>
      </Box>
    </ThemeProvider>
  );
}

