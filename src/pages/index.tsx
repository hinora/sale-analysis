import { useState, useEffect } from "react";
import {
  Container,
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Button,
  CircularProgress,
  Alert,
} from "@mui/material";
import {
  Upload as UploadIcon,
  Search as SearchIcon,
  Inventory as InventoryIcon,
  Business as BusinessIcon,
  Psychology as PsychologyIcon,
  TrendingUp as TrendingUpIcon,
} from "@mui/icons-material";
import { useRouter } from "next/router";
import PageHeader from "@/components/layout/PageHeader";

/**
 * Dashboard statistics
 */
interface DashboardStats {
  totalTransactions: number;
  totalCompanies: number;
  totalGoods: number;
  totalValueUSD: number;
  lastImportDate: string | null;
}

/**
 * Quick action button
 */
interface QuickAction {
  title: string;
  description: string;
  icon: React.ReactNode;
  href: string;
  color: "primary" | "secondary" | "success" | "info" | "warning";
}

export default function Home() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick actions for navigation
  const quickActions: QuickAction[] = [
    {
      title: "Nhập dữ liệu CSV",
      description: "Tải lên file dữ liệu xuất khẩu",
      icon: <UploadIcon fontSize="large" />,
      href: "/import",
      color: "primary",
    },
    {
      title: "Tra cứu giao dịch",
      description: "Tìm kiếm và lọc giao dịch",
      icon: <SearchIcon fontSize="large" />,
      href: "/transactions",
      color: "secondary",
    },
    {
      title: "Danh mục hàng hóa",
      description: "Xem thống kê theo sản phẩm",
      icon: <InventoryIcon fontSize="large" />,
      href: "/goods",
      color: "success",
    },
    {
      title: "Phân tích công ty",
      description: "Xem thống kê theo khách hàng",
      icon: <BusinessIcon fontSize="large" />,
      href: "/companies",
      color: "info",
    },
    {
      title: "Phân tích AI",
      description: "Đặt câu hỏi bằng ngôn ngữ tự nhiên",
      icon: <PsychologyIcon fontSize="large" />,
      href: "/ai-analysis",
      color: "warning",
    },
  ];

  // Fetch dashboard statistics
  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch statistics from API
        const response = await fetch("/api/dashboard/stats");

        if (!response.ok) {
          throw new Error("Failed to fetch dashboard statistics");
        }

        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error("[Dashboard] Error fetching stats:", err);
        setError(
          err instanceof Error ? err.message : "Failed to load statistics",
        );
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Format large numbers
  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  // Format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageHeader
        title="Bảng điều khiển"
        subtitle="Hệ thống phân tích dữ liệu xuất khẩu hàng hóa"
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Statistics Overview */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Tổng quan hệ thống
        </Typography>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : stats ? (
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Tổng giao dịch
                  </Typography>
                  <Typography variant="h4" component="div">
                    {formatNumber(stats.totalTransactions)}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    {stats.totalTransactions.toLocaleString("vi-VN")} giao dịch
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Tổng công ty
                  </Typography>
                  <Typography variant="h4" component="div">
                    {formatNumber(stats.totalCompanies)}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    {stats.totalCompanies.toLocaleString("vi-VN")} khách hàng
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Tổng mặt hàng
                  </Typography>
                  <Typography variant="h4" component="div">
                    {formatNumber(stats.totalGoods)}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    {stats.totalGoods.toLocaleString("vi-VN")} sản phẩm
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} sm={6} md={3}>
              <Card>
                <CardContent>
                  <Typography color="text.secondary" gutterBottom>
                    Tổng giá trị
                  </Typography>
                  <Typography variant="h4" component="div">
                    {formatNumber(stats.totalValueUSD)}
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ mt: 1 }}
                  >
                    {formatCurrency(stats.totalValueUSD)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>

            {stats.lastImportDate && (
              <Grid item xs={12}>
                <Alert severity="info" icon={<TrendingUpIcon />}>
                  Nhập dữ liệu gần nhất:{" "}
                  {new Date(stats.lastImportDate).toLocaleString("vi-VN")}
                </Alert>
              </Grid>
            )}
          </Grid>
        ) : (
          <Alert severity="info">
            Chưa có dữ liệu. Vui lòng nhập file CSV để bắt đầu.
          </Alert>
        )}
      </Box>

      {/* Quick Actions */}
      <Box>
        <Typography variant="h6" gutterBottom>
          Chức năng chính
        </Typography>
        <Grid container spacing={3}>
          {quickActions.map((action, index) => (
            <Grid item xs={12} sm={6} md={4} key={index}>
              <Card
                sx={{
                  height: "100%",
                  cursor: "pointer",
                  transition: "transform 0.2s, box-shadow 0.2s",
                  "&:hover": {
                    transform: "translateY(-4px)",
                    boxShadow: 4,
                  },
                }}
                onClick={() => router.push(action.href)}
              >
                <CardContent>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      mb: 2,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 56,
                        height: 56,
                        borderRadius: 2,
                        bgcolor: `${action.color}.main`,
                        color: "white",
                        mr: 2,
                      }}
                    >
                      {action.icon}
                    </Box>
                    <Typography variant="h6" component="div">
                      {action.title}
                    </Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {action.description}
                  </Typography>
                  <Button
                    variant="outlined"
                    color={action.color}
                    sx={{ mt: 2 }}
                    fullWidth
                  >
                    Truy cập
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Box>
    </Container>
  );
}
