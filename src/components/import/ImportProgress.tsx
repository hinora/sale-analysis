import { Box, Typography, CircularProgress } from '@mui/material';

interface ImportProgressProps {
  progress: number;
  state: 'uploading' | 'processing';
}

/**
 * Import progress indicator
 */
export default function ImportProgress({ progress, state }: ImportProgressProps) {
  return (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <CircularProgress size={60} thickness={4} />

      <Typography variant="h6" sx={{ mt: 3 }}>
        {state === 'uploading' ? 'Đang tải file lên...' : 'Đang xử lý dữ liệu...'}
      </Typography>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        {progress < 25 && 'Đọc file CSV...'}
        {progress >= 25 && progress < 50 && 'Kiểm tra định dạng...'}
        {progress >= 50 && progress < 75 && 'Phân loại hàng hóa bằng AI...'}
        {progress >= 75 && 'Lưu vào cơ sở dữ liệu...'}
      </Typography>
    </Box>
  );
}
