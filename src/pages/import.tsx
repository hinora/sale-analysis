import { useState } from "react";
import { Box, Typography, Button, Alert, LinearProgress } from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import PageHeader from "@/components/layout/PageHeader";
import FileUpload from "@/components/import/FileUpload";
import ImportProgress from "@/components/import/ImportProgress";
import ImportSummary from "@/components/import/ImportSummary";

/**
 * Import state
 */
type ImportState = "idle" | "uploading" | "processing" | "complete" | "error";

/**
 * Import stats from API response
 */
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

/**
 * Import page - User Story 1
 * CSV upload with duplicate detection, AI classification, and progress tracking
 */
export default function ImportPage() {
  const [state, setState] = useState<ImportState>("idle");
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  /**
   * Handle file upload
   */
  const handleFileUpload = async (file: File) => {
    // Reset state
    setState("uploading");
    setProgress(0);
    setStats(null);
    setErrorMessage("");

    try {
      // Read file content
      const fileContent = await file.text();

      setProgress(25);
      setState("processing");

      // Upload to API
      const response = await fetch("/api/import/upload", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ csvContent: fileContent }),
      });

      setProgress(75);

      const result = await response.json();

      // Even if response is not ok (400), we still have stats with errors to display
      if (result.stats) {
        setStats(result.stats);
        setState("complete");
        setProgress(100);
      } else if (!response.ok) {
        throw new Error(result.message || "Upload failed");
      } else {
        // Success
        setStats(result.stats);
        setState("complete");
        setProgress(100);
      }
    } catch (error) {
      console.error("[Import] Upload error:", error);
      setErrorMessage(error instanceof Error ? error.message : "Upload failed");
      setState("error");
    }
  };

  /**
   * Handle template download
   */
  const handleDownloadTemplate = () => {
    window.open("/api/import/template", "_blank");
  };

  /**
   * Handle import another file
   */
  const handleReset = () => {
    setState("idle");
    setProgress(0);
    setStats(null);
    setErrorMessage("");
  };

  return (
    <Box>
      <PageHeader
        title="Nhập dữ liệu CSV"
        subtitle="Tải lên file CSV xuất khẩu hàng hóa, tự động phân loại và phát hiện trùng lặp"
        breadcrumbs={[{ label: "Trang chủ", href: "/" }, { label: "Nhập CSV" }]}
      />

      <Box sx={{ p: 3 }}>
        {/* Instructions */}
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2" gutterBottom>
            <strong>Hướng dẫn:</strong>
          </Typography>
          <Typography variant="body2" component="ul" sx={{ m: 0, pl: 2 }}>
            <li>Tải file CSV với định dạng mẫu (bao gồm 24 cột bắt buộc)</li>
            <li>Hệ thống sẽ tự động phân loại hàng hóa bằng AI</li>
            <li>Tự động phát hiện và bỏ qua các bản ghi trùng lặp</li>
            <li>Dữ liệu gốc được lưu trữ đầy đủ cho kiểm tra</li>
          </Typography>
        </Alert>

        {/* Download Template Button */}
        <Box sx={{ mb: 3 }}>
          <Button
            variant="outlined"
            startIcon={<DownloadIcon />}
            onClick={handleDownloadTemplate}
            disabled={state === "uploading" || state === "processing"}
          >
            Tải xuống file mẫu
          </Button>
        </Box>

        {/* File Upload */}
        {state === "idle" && (
          <FileUpload onFileSelect={handleFileUpload} disabled={false} />
        )}

        {state === "error" && (
          <FileUpload onFileSelect={handleFileUpload} disabled={false} />
        )}

        {/* Progress */}
        {(state === "uploading" || state === "processing") && (
          <Box sx={{ mb: 3 }}>
            <ImportProgress progress={progress} state={state} />
            <LinearProgress
              variant="determinate"
              value={progress}
              sx={{ mt: 2, height: 8, borderRadius: 4 }}
            />
          </Box>
        )}

        {/* Error */}
        {state === "error" && errorMessage && (
          <Alert severity="error" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>Lỗi:</strong> {errorMessage}
            </Typography>
          </Alert>
        )}

        {/* Summary */}
        {state === "complete" && stats && (
          <Box>
            <ImportSummary stats={stats} />
            <Box sx={{ mt: 3 }}>
              <Button variant="contained" onClick={handleReset}>
                Nhập file khác
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
}
