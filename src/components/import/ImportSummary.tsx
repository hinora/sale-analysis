import type React from "react";
import { Box, Paper, Typography, Grid, Alert, Divider } from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import ErrorIcon from "@mui/icons-material/Error";
import InfoIcon from "@mui/icons-material/Info";

interface ImportStats {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicatesInFile: number;
  duplicatesInDB: number;
  importedRows: number;
  newCompanies: number;
  newGoods: number;
  errors: string[];
}

interface ImportSummaryProps {
  stats: ImportStats;
}

/**
 * Import summary display
 */
export default function ImportSummary({ stats }: ImportSummaryProps) {
  const hasErrors = stats.errors.length > 0;
  const hasWarnings = stats.duplicatesInFile > 0 || stats.duplicatesInDB > 0;

  return (
    <Box>
      {/* Success/Warning Header */}
      {!hasErrors && (
        <Alert
          severity={hasWarnings ? "warning" : "success"}
          icon={hasWarnings ? <WarningIcon /> : <CheckCircleIcon />}
          sx={{ mb: 3 }}
        >
          <Typography variant="body1" fontWeight="bold">
            {hasWarnings
              ? `Nhập thành công ${stats.importedRows} giao dịch với một số cảnh báo`
              : `Nhập thành công ${stats.importedRows} giao dịch`}
          </Typography>
        </Alert>
      )}

      {/* Statistics Grid */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Thống kê nhập liệu
        </Typography>
        <Divider sx={{ mb: 2 }} />

        <Grid container spacing={3}>
          {/* Total Rows */}
          <Grid item xs={12} sm={6} md={3}>
            <StatItem
              label="Tổng số dòng"
              value={stats.totalRows}
              color="primary"
              icon={<InfoIcon />}
            />
          </Grid>

          {/* Valid Rows */}
          <Grid item xs={12} sm={6} md={3}>
            <StatItem
              label="Dòng hợp lệ"
              value={stats.validRows}
              color="success"
              icon={<CheckCircleIcon />}
            />
          </Grid>

          {/* Invalid Rows */}
          {stats.invalidRows > 0 && (
            <Grid item xs={12} sm={6} md={3}>
              <StatItem
                label="Dòng không hợp lệ"
                value={stats.invalidRows}
                color="error"
                icon={<ErrorIcon />}
              />
            </Grid>
          )}

          {/* Duplicates in File */}
          {stats.duplicatesInFile > 0 && (
            <Grid item xs={12} sm={6} md={3}>
              <StatItem
                label="Trùng lặp trong file"
                value={stats.duplicatesInFile}
                color="warning"
                icon={<WarningIcon />}
              />
            </Grid>
          )}

          {/* Duplicates in DB */}
          {stats.duplicatesInDB > 0 && (
            <Grid item xs={12} sm={6} md={3}>
              <StatItem
                label="Trùng lặp trong CSDL"
                value={stats.duplicatesInDB}
                color="warning"
                icon={<WarningIcon />}
              />
            </Grid>
          )}

          {/* Imported Rows */}
          <Grid item xs={12} sm={6} md={3}>
            <StatItem
              label="Giao dịch đã nhập"
              value={stats.importedRows}
              color="success"
              icon={<CheckCircleIcon />}
            />
          </Grid>

          {/* New Companies */}
          <Grid item xs={12} sm={6} md={3}>
            <StatItem
              label="Doanh nghiệp mới"
              value={stats.newCompanies}
              color="info"
            />
          </Grid>

          {/* New Goods */}
          <Grid item xs={12} sm={6} md={3}>
            <StatItem
              label="Hàng hóa mới"
              value={stats.newGoods}
              color="info"
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Errors */}
      {hasErrors && (
        <Alert severity="error" icon={<ErrorIcon />} sx={{ mb: 3 }}>
          <Typography variant="body2" fontWeight="bold" gutterBottom>
            Có {stats.errors.length} lỗi xảy ra:
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2 }}>
            {stats.errors.slice(0, 10).map((error, index) => (
              <Typography
                key={`${error.substring(0, 20)}-${index}`}
                component="li"
                variant="body2"
                sx={{ mb: 0.5 }}
              >
                {error}
              </Typography>
            ))}
            {stats.errors.length > 10 && (
              <Typography variant="body2" fontStyle="italic">
                ... và {stats.errors.length - 10} lỗi khác
              </Typography>
            )}
          </Box>
        </Alert>
      )}
    </Box>
  );
}

/**
 * Stat item component
 */
interface StatItemProps {
  label: string;
  value: number;
  color: "primary" | "secondary" | "success" | "warning" | "error" | "info";
  icon?: React.ReactNode;
}

function StatItem({ label, value, color, icon }: StatItemProps) {
  const IconComponent = icon as React.ReactElement;

  return (
    <Box sx={{ textAlign: "center" }}>
      {icon && (
        <Box sx={{ mb: 1, color: `${color}.main`, fontSize: 32 }}>
          {IconComponent}
        </Box>
      )}
      <Typography variant="h4" color={`${color}.main`} fontWeight="bold">
        {value.toLocaleString("vi-VN")}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Box>
  );
}
