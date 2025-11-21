import { useState, useMemo } from "react";
import { FixedSizeList as List } from "react-window";
import {
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  TablePagination,
  Typography,
} from "@mui/material";

/**
 * Column definition for DataTable
 */
export interface DataTableColumn<T = unknown> {
  id: string;
  label: string;
  minWidth?: number;
  align?: "left" | "right" | "center";
  format?: (value: unknown, row: T) => string | number | React.ReactNode;
  sortable?: boolean;
}

/**
 * Props for DataTable component
 */
export interface DataTableProps<T = unknown> {
  columns: DataTableColumn<T>[];
  rows: T[];
  rowHeight?: number;
  maxHeight?: number;
  pagination?: boolean;
  rowsPerPageOptions?: number[];
  onSort?: (columnId: string, direction: "asc" | "desc") => void;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  emptyMessage?: string;
  virtualized?: boolean; // Enable virtualization for large datasets
}

/**
 * Reusable data table component with optional virtualization
 * Features:
 * - Sortable columns
 * - Pagination
 * - react-window virtualization for large datasets
 * - Responsive design
 */
export default function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  rowHeight = 53,
  maxHeight = 600,
  pagination = true,
  rowsPerPageOptions = [10, 25, 50, 100],
  onSort,
  sortBy,
  sortDirection = "asc",
  emptyMessage = "Không có dữ liệu",
  virtualized = false,
}: DataTableProps<T>) {
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[0]);

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setRowsPerPage(Number.parseInt(event.target.value, 10));
    setPage(0);
  };

  // Calculate paginated rows
  const paginatedRows = useMemo(() => {
    if (!pagination) return rows;
    const start = page * rowsPerPage;
    return rows.slice(start, start + rowsPerPage);
  }, [rows, page, rowsPerPage, pagination]);

  // Render a single row
  const renderRow = (row: T, index: number) => (
    <TableRow hover tabIndex={-1} key={index}>
      {columns.map((column) => {
        const value = row[column.id];
        return (
          <TableCell key={column.id} align={column.align || "left"}>
            {column.format ? column.format(value, row) : String(value ?? "")}
          </TableCell>
        );
      })}
    </TableRow>
  );

  // Virtualized row renderer for react-window
  const VirtualRow = ({
    index,
    style,
  }: {
    index: number;
    style: React.CSSProperties;
  }) => {
    const row = paginatedRows[index];
    return (
      <div style={style}>
        <Table>
          <TableBody>{renderRow(row, index)}</TableBody>
        </Table>
      </div>
    );
  };

  if (rows.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 200,
          p: 3,
        }}
      >
        <Typography variant="body1" color="text.secondary">
          {emptyMessage}
        </Typography>
      </Box>
    );
  }

  return (
    <Paper sx={{ width: "100%", overflow: "hidden" }}>
      <TableContainer sx={{ maxHeight: virtualized ? undefined : maxHeight }}>
        <Table stickyHeader>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align || "left"}
                  style={{ minWidth: column.minWidth }}
                >
                  {column.sortable && onSort ? (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        cursor: "pointer",
                        userSelect: "none",
                        "&:hover": {
                          color: "primary.main",
                        },
                      }}
                      onClick={() => {
                        const newDirection =
                          sortBy === column.id && sortDirection === "asc"
                            ? "desc"
                            : "asc";
                        onSort(column.id, newDirection);
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight={600}>
                        {column.label}
                      </Typography>
                      {sortBy === column.id && (
                        <Typography variant="caption" sx={{ ml: 0.5 }}>
                          {sortDirection === "asc" ? "↑" : "↓"}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="subtitle2" fontWeight={600}>
                      {column.label}
                    </Typography>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          {!virtualized && (
            <TableBody>{paginatedRows.map(renderRow)}</TableBody>
          )}
        </Table>

        {/* Virtualized rendering for large datasets */}
        {virtualized && (
          <List
            height={maxHeight}
            itemCount={paginatedRows.length}
            itemSize={rowHeight}
            width="100%"
          >
            {VirtualRow}
          </List>
        )}
      </TableContainer>

      {/* Pagination */}
      {pagination && (
        <TablePagination
          rowsPerPageOptions={rowsPerPageOptions}
          component="div"
          count={rows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
          labelRowsPerPage="Số hàng mỗi trang:"
          labelDisplayedRows={({ from, to, count }) =>
            `${from}-${to} của ${count !== -1 ? count : `nhiều hơn ${to}`}`
          }
        />
      )}
    </Paper>
  );
}
