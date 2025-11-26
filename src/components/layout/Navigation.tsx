import Link from "next/link";
import { useRouter } from "next/router";
import { useState } from "react";
import {
  AppBar,
  Toolbar,
  Typography,
  Box,
  Button,
  Container,
  Switch,
  FormControlLabel,
  Tooltip,
} from "@mui/material";
import {
  UploadFile as UploadIcon,
  Search as SearchIcon,
  Category as CategoryIcon,
  Business as BusinessIcon,
  Psychology as AIIcon,
} from "@mui/icons-material";

/**
 * Main navigation component with links to all features
 * Features:
 * - Active route highlighting
 * - Responsive design
 * - Icon + text navigation
 * - Auto-classify toggle control
 */
export default function Navigation() {
  const router = useRouter();
  const [autoClassifyEnabled, setAutoClassifyEnabled] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleAutoClassifyToggle = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const enabled = event.target.checked;
    setIsToggling(true);

    try {
      if (enabled) {
        // Start the job
        const response = await fetch("/api/jobs/classify-goods", {
          method: "POST",
        });

        if (response.status === 202 || response.status === 409) {
          setAutoClassifyEnabled(true);
          console.log("[Navigation] Auto-classify job started");
        } else {
          console.error("[Navigation] Failed to start job:", response.status);
          // Revert toggle on failure
          setAutoClassifyEnabled(false);
        }
      } else {
        // Stop the job
        const response = await fetch("/api/jobs/classify-goods", {
          method: "DELETE",
        });

        if (response.ok) {
          setAutoClassifyEnabled(false);
          console.log("[Navigation] Auto-classify job stopped");
        } else {
          console.error("[Navigation] Failed to stop job:", response.status);
          // Revert toggle on failure
          setAutoClassifyEnabled(true);
        }
      }
    } catch (error) {
      console.error("[Navigation] Error toggling auto-classify:", error);
      // Revert toggle on error
      setAutoClassifyEnabled(!enabled);
    } finally {
      setIsToggling(false);
    }
  };

  const navItems = [
    { label: "Nhập CSV", href: "/import", icon: <UploadIcon /> },
    { label: "Tra cứu giao dịch", href: "/transactions", icon: <SearchIcon /> },
    { label: "Danh mục hàng hóa", href: "/goods", icon: <CategoryIcon /> },
    { label: "Phân tích công ty", href: "/companies", icon: <BusinessIcon /> },
    { label: "AI Phân tích", href: "/ai-analysis", icon: <AIIcon /> },
  ];

  return (
    <AppBar position="sticky" elevation={1}>
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          {/* Logo/Brand */}
          <Typography
            variant="h6"
            component={Link}
            href="/"
            sx={{
              flexGrow: 0,
              fontWeight: 700,
              letterSpacing: ".1rem",
              color: "white",
              cursor: "pointer",
              mr: 4,
              textDecoration: "none",
              "&:hover": {
                opacity: 0.9,
              },
            }}
          >
            Export Goods Analysis
          </Typography>

          {/* Navigation Links */}
          <Box sx={{ flexGrow: 1, display: "flex", gap: 1 }}>
            {navItems.map((item) => {
              const isActive = router.pathname === item.href;
              return (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  startIcon={item.icon}
                  sx={{
                    color: "white",
                    backgroundColor: isActive
                      ? "rgba(255, 255, 255, 0.15)"
                      : "transparent",
                    "&:hover": {
                      backgroundColor: "rgba(255, 255, 255, 0.1)",
                    },
                    fontWeight: isActive ? 600 : 400,
                    textDecoration: "none",
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Box>

          {/* Auto-Classify Toggle */}
          <Box sx={{ ml: 2 }}>
            <Tooltip
              title={
                autoClassifyEnabled
                  ? "Tắt phân loại tự động"
                  : "Bật phân loại tự động"
              }
            >
              <FormControlLabel
                control={
                  <Switch
                    checked={autoClassifyEnabled}
                    onChange={handleAutoClassifyToggle}
                    disabled={isToggling}
                    sx={{
                      "& .MuiSwitch-switchBase.Mui-checked": {
                        color: "white",
                      },
                      "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track":
                        {
                          backgroundColor: "rgba(255, 255, 255, 0.5)",
                        },
                    }}
                  />
                }
                label={
                  <Typography variant="body2" sx={{ color: "white" }}>
                    Auto-Classify
                  </Typography>
                }
              />
            </Tooltip>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
