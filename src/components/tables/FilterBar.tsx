import { Box, TextField, Button, Paper, Grid } from '@mui/material';
import { Clear as ClearIcon, Search as SearchIcon } from '@mui/icons-material';

/**
 * Filter field definition
 */
export interface FilterField {
  id: string;
  label: string;
  type: 'text' | 'select' | 'date' | 'dateRange' | 'custom';
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  customComponent?: React.ReactNode;
}

/**
 * Props for FilterBar component
 */
export interface FilterBarProps {
  filters: FilterField[];
  values: Record<string, unknown>;
  onChange: (filterId: string, value: unknown) => void;
  onSearch: () => void;
  onClear: () => void;
  loading?: boolean;
}

/**
 * Reusable filter bar component for common filtering patterns
 * Features:
 * - Text inputs
 * - Select dropdowns
 * - Date pickers
 * - Custom filter components
 * - Search and clear actions
 */
export default function FilterBar({
  filters,
  values,
  onChange,
  onSearch,
  onClear,
  loading = false,
}: FilterBarProps) {
  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !loading) {
      onSearch();
    }
  };

  const renderFilter = (filter: FilterField) => {
    const value = values[filter.id] || '';

    switch (filter.type) {
      case 'text':
        return (
          <TextField
            fullWidth
            label={filter.label}
            placeholder={filter.placeholder}
            value={value}
            onChange={(e) => onChange(filter.id, e.target.value)}
            onKeyPress={handleKeyPress}
            size="small"
            disabled={loading}
          />
        );

      case 'select':
        return (
          <TextField
            fullWidth
            select
            label={filter.label}
            value={value}
            onChange={(e) => onChange(filter.id, e.target.value)}
            size="small"
            disabled={loading}
            SelectProps={{
              native: true,
            }}
          >
            <option value="">-- {filter.label} --</option>
            {filter.options?.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </TextField>
        );

      case 'date':
        return (
          <TextField
            fullWidth
            type="date"
            label={filter.label}
            value={value}
            onChange={(e) => onChange(filter.id, e.target.value)}
            size="small"
            disabled={loading}
            InputLabelProps={{
              shrink: true,
            }}
          />
        );

      case 'custom':
        return filter.customComponent;

      default:
        return null;
    }
  };

  return (
    <Paper sx={{ p: 2, mb: 3 }}>
      <Grid container spacing={2} alignItems="center">
        {filters.map((filter) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={filter.id}>
            {renderFilter(filter)}
          </Grid>
        ))}

        {/* Action buttons */}
        <Grid item xs={12} sm={6} md={4} lg={3}>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<SearchIcon />}
              onClick={onSearch}
              disabled={loading}
              fullWidth
            >
              Tìm kiếm
            </Button>
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={onClear}
              disabled={loading}
            >
              Xóa
            </Button>
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
}
