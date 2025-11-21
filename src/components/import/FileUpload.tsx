import { useCallback, useState } from "react";
import type React from "react";
import { Box, Paper, Typography } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

interface FileUploadProps {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

/**
 * Drag-and-drop file upload component
 */
export default function FileUpload({
  onFileSelect,
  disabled = false,
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);

  /**
   * Handle file drop
   */
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      if (disabled) return;

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        if (file.type === "text/csv" || file.name.endsWith(".csv")) {
          onFileSelect(file);
        } else {
          alert("Vui lòng chọn file CSV (.csv)");
        }
      }
    },
    [disabled, onFileSelect],
  );

  /**
   * Handle drag over
   */
  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  /**
   * Handle drag leave
   */
  const handleDragLeave = useCallback(() => {
    setIsDragging(false);
  }, []);

  /**
   * Handle file input change
   */
  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        onFileSelect(files[0]);
      }
    },
    [onFileSelect],
  );

  return (
    <Paper
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      sx={{
        p: 6,
        textAlign: "center",
        border: "2px dashed",
        borderColor: isDragging ? "primary.main" : "divider",
        backgroundColor: isDragging ? "action.hover" : "background.paper",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        transition: "all 0.2s",
        "&:hover": {
          borderColor: disabled ? "divider" : "primary.main",
          backgroundColor: disabled ? "background.paper" : "action.hover",
        },
      }}
    >
      <CloudUploadIcon sx={{ fontSize: 64, color: "primary.main", mb: 2 }} />

      <Typography variant="h6" gutterBottom>
        Kéo thả file CSV vào đây
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        hoặc
      </Typography>

      <Box component="label">
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          disabled={disabled}
          style={{ display: "none" }}
        />
        <Box
          component="span"
          sx={{
            display: "inline-block",
            px: 3,
            py: 1.5,
            borderRadius: 1,
            backgroundColor: "primary.main",
            color: "white",
            cursor: disabled ? "not-allowed" : "pointer",
            "&:hover": {
              backgroundColor: disabled ? "primary.main" : "primary.dark",
            },
          }}
        >
          Chọn file từ máy tính
        </Box>
      </Box>

      <Typography
        variant="caption"
        display="block"
        sx={{ mt: 2, color: "text.secondary" }}
      >
        Chỉ chấp nhận file CSV (tối đa 100MB)
      </Typography>
    </Paper>
  );
}
