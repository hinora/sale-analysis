import { createTheme } from "@mui/material/styles";
import { viVN } from "@mui/material/locale";

/**
 * Material-UI theme configuration for Export Goods Analysis application
 * Features:
 * - Vietnamese locale support
 * - Primary color: Blue for trust and professionalism
 * - Secondary color: Green for success and growth
 * - Custom spacing and typography
 */
export const theme = createTheme(
  {
    palette: {
      mode: "light",
      primary: {
        main: "#1976d2", // Blue
        light: "#42a5f5",
        dark: "#1565c0",
        contrastText: "#fff",
      },
      secondary: {
        main: "#388e3c", // Green
        light: "#66bb6a",
        dark: "#2e7d32",
        contrastText: "#fff",
      },
      error: {
        main: "#d32f2f",
        light: "#ef5350",
        dark: "#c62828",
      },
      warning: {
        main: "#ed6c02",
        light: "#ff9800",
        dark: "#e65100",
      },
      info: {
        main: "#0288d1",
        light: "#03a9f4",
        dark: "#01579b",
      },
      success: {
        main: "#2e7d32",
        light: "#4caf50",
        dark: "#1b5e20",
      },
      background: {
        default: "#f5f5f5",
        paper: "#ffffff",
      },
    },
    typography: {
      fontFamily: [
        "-apple-system",
        "BlinkMacSystemFont",
        '"Segoe UI"',
        "Roboto",
        '"Helvetica Neue"',
        "Arial",
        "sans-serif",
        '"Apple Color Emoji"',
        '"Segoe UI Emoji"',
        '"Segoe UI Symbol"',
      ].join(","),
      h1: {
        fontSize: "2.5rem",
        fontWeight: 600,
        lineHeight: 1.2,
      },
      h2: {
        fontSize: "2rem",
        fontWeight: 600,
        lineHeight: 1.3,
      },
      h3: {
        fontSize: "1.75rem",
        fontWeight: 600,
        lineHeight: 1.4,
      },
      h4: {
        fontSize: "1.5rem",
        fontWeight: 500,
        lineHeight: 1.4,
      },
      h5: {
        fontSize: "1.25rem",
        fontWeight: 500,
        lineHeight: 1.5,
      },
      h6: {
        fontSize: "1rem",
        fontWeight: 500,
        lineHeight: 1.5,
      },
      body1: {
        fontSize: "1rem",
        lineHeight: 1.5,
      },
      body2: {
        fontSize: "0.875rem",
        lineHeight: 1.43,
      },
    },
    spacing: 8, // Base spacing unit (1 = 8px)
    shape: {
      borderRadius: 8, // Rounded corners
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none", // Disable uppercase transformation
            fontWeight: 500,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          },
        },
      },
      MuiTextField: {
        defaultProps: {
          variant: "outlined",
          size: "medium",
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: "none", // Disable MUI elevation gradient
          },
        },
      },
    },
  },
  viVN, // Vietnamese locale
);
