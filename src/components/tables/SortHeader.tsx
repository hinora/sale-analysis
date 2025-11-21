import { TableCell, TableSortLabel, Box, Typography } from '@mui/material';

/**
 * Props for SortHeader component
 */
export interface SortHeaderProps {
  id: string;
  label: string;
  active: boolean;
  direction: 'asc' | 'desc';
  onSort: (columnId: string) => void;
  align?: 'left' | 'right' | 'center';
  minWidth?: number;
}

/**
 * Reusable sortable table header component
 * Features:
 * - Visual sort indicator
 * - Click to toggle sort direction
 * - Accessible keyboard navigation
 */
export default function SortHeader({
  id,
  label,
  active,
  direction,
  onSort,
  align = 'left',
  minWidth,
}: SortHeaderProps) {
  const handleSort = () => {
    onSort(id);
  };

  return (
    <TableCell align={align} style={{ minWidth }}>
      <TableSortLabel
        active={active}
        direction={active ? direction : 'asc'}
        onClick={handleSort}
        sx={{
          '& .MuiTableSortLabel-icon': {
            opacity: 0.5,
          },
          '&.Mui-active .MuiTableSortLabel-icon': {
            opacity: 1,
          },
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          {label}
        </Typography>
        {active && (
          <Box
            component="span"
            sx={{
              border: 0,
              clip: 'rect(0 0 0 0)',
              height: 1,
              margin: -1,
              overflow: 'hidden',
              padding: 0,
              position: 'absolute',
              top: 20,
              width: 1,
            }}
          >
            {direction === 'desc' ? 'sorted descending' : 'sorted ascending'}
          </Box>
        )}
      </TableSortLabel>
    </TableCell>
  );
}
