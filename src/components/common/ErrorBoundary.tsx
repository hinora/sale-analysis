import React, { Component, ErrorInfo, ReactNode } from "react";
import { Container, Box, Typography, Button, Alert } from "@mui/material";
import {
  Error as ErrorIcon,
  Refresh as RefreshIcon,
} from "@mui/icons-material";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree and displays a fallback UI
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });

    // You can log the error to an error reporting service here
    // Example: logErrorToService(error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <Container maxWidth="md" sx={{ py: 8 }}>
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
            }}
          >
            <ErrorIcon
              sx={{
                fontSize: 80,
                color: "error.main",
                mb: 3,
              }}
            />
            <Typography variant="h4" gutterBottom>
              Đã xảy ra lỗi
            </Typography>
            <Typography variant="body1" color="text.secondary" paragraph>
              Xin lỗi, đã có lỗi xảy ra khi hiển thị trang này. Vui lòng thử
              lại.
            </Typography>

            {this.state.error && process.env.NODE_ENV === "development" && (
              <Alert
                severity="error"
                sx={{ mt: 2, mb: 3, width: "100%", textAlign: "left" }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  <strong>Error:</strong> {this.state.error.message}
                </Typography>
                {this.state.errorInfo && (
                  <Typography
                    variant="caption"
                    component="pre"
                    sx={{
                      mt: 1,
                      p: 1,
                      bgcolor: "grey.100",
                      borderRadius: 1,
                      overflow: "auto",
                      fontSize: "0.75rem",
                    }}
                  >
                    {this.state.errorInfo.componentStack}
                  </Typography>
                )}
              </Alert>
            )}

            <Box sx={{ display: "flex", gap: 2, mt: 2 }}>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={this.handleReset}
              >
                Thử lại
              </Button>
              <Button variant="outlined" onClick={this.handleReload}>
                Tải lại trang
              </Button>
            </Box>
          </Box>
        </Container>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
