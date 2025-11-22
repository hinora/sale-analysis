import { useState, useEffect, useCallback } from "react";
import {
  Container,
  Box,
  TextField,
  MenuItem,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Typography,
  TablePagination,
  CircularProgress,
  Alert,
} from "@mui/material";
import { Visibility as VisibilityIcon } from "@mui/icons-material";
import PageHeader from "@/components/layout/PageHeader";
import DataTable from "@/components/tables/DataTable";
import CategorySelect from "@/components/common/CategorySelect";
import { formatUSD, formatDate } from "@/lib/utils/formatting";

/**
 * Company data interface
 */
interface Company {
  _id: string;
  name: string;
  address: string;
  totalTransactions: number;
  totalImportValue: number;
  totalQuantity: number;
  uniqueGoodsCount: number;
  firstTransactionDate: string;
  lastTransactionDate: string;
}

/**
 * Transaction interface for detail view
 */
interface Transaction {
  _id: string;
  declarationNumber: string;
  date: string;
  goodsName: string;
  goodsShortName: string;
  category: string;
  hsCode: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
}

/**
 * Filter state
 */
interface FilterState {
  category: string;
  dateFrom: string;
  dateTo: string;
  search: string;
  sortBy: string;
  sortOrder: "asc" | "desc";
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    category: "",
    dateFrom: "",
    dateTo: "",
    search: "",
    sortBy: "totalImportValue",
    sortOrder: "desc",
  });

  // Detail modal
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [detailTransactions, setDetailTransactions] = useState<Transaction[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  /**
   * Fetch companies list
   */
  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
      });

      if (filters.category) params.append("category", filters.category);
      if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
      if (filters.dateTo) params.append("dateTo", filters.dateTo);
      if (filters.search) params.append("search", filters.search);

      const response = await fetch(`/api/companies/list?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch companies");
      }

      setCompanies(data.companies);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setCompanies([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters]);

  /**
   * Fetch company detail
   */
  const fetchCompanyDetail = async (companyId: string) => {
    try {
      setDetailLoading(true);

      const response = await fetch(`/api/companies/${companyId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Failed to fetch company detail");
      }

      setSelectedCompany(data.company);
      setDetailTransactions(data.transactions);
      setDetailOpen(true);
    } catch (err) {
      console.error("Failed to fetch company detail:", err);
      alert(err instanceof Error ? err.message : "Failed to fetch company detail");
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * Handle filter change
   */
  const handleFilterChange = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page on filter change
  };

  /**
   * Handle page change
   */
  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage + 1); // MUI TablePagination is 0-indexed
  };

  /**
   * Handle page size change
   */
  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(1);
  };

  /**
   * Handle sort change
   */
  const handleSortChange = (field: string, direction: "asc" | "desc") => {
    setFilters((prev) => ({
      ...prev,
      sortBy: field,
      sortOrder: direction,
    }));
    setPage(1);
  };

  /**
   * Close detail modal
   */
  const handleCloseDetail = () => {
    setDetailOpen(false);
    setSelectedCompany(null);
    setDetailTransactions([]);
  };

  // Fetch data on mount and filter/page change
  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  /**
   * DataTable columns
   */
  const columns = [
    {
      id: "name",
      label: "Tên công ty",
      minWidth: 250,
      sortable: true,
    },
    {
      id: "address",
      label: "Địa chỉ",
      minWidth: 200,
      sortable: false,
    },
    {
      id: "totalImportValue",
      label: "Tổng trị giá nhập khẩu",
      minWidth: 180,
      sortable: true,
      align: "right" as const,
    },
    {
      id: "totalQuantity",
      label: "Tổng số lượng",
      minWidth: 130,
      sortable: true,
      align: "right" as const,
    },
    {
      id: "totalTransactions",
      label: "Số giao dịch",
      minWidth: 120,
      sortable: true,
      align: "right" as const,
    },
    {
      id: "uniqueGoodsCount",
      label: "Số mặt hàng",
      minWidth: 120,
      sortable: true,
      align: "right" as const,
    },
    {
      id: "lastTransactionDate",
      label: "Giao dịch gần nhất",
      minWidth: 150,
      sortable: true,
      align: "right" as const,
    },
    {
      id: "actions",
      label: "Thao tác",
      minWidth: 100,
      sortable: false,
      align: "center" as const,
      format: (value: unknown) => (
        <IconButton
          size="small"
          onClick={() => fetchCompanyDetail(value as string)}
          disabled={detailLoading}
        >
          <VisibilityIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  // Format row data for display
  const formatRow = (company: Company) => {
    return {
      _id: company._id,
      name: company.name,
      address: company.address,
      totalImportValue: formatUSD(company.totalImportValue),
      totalQuantity: company.totalQuantity.toLocaleString(),
      totalTransactions: company.totalTransactions.toLocaleString(),
      uniqueGoodsCount: company.uniqueGoodsCount.toLocaleString(),
      lastTransactionDate: formatDate(new Date(company.lastTransactionDate)),
      actions: company._id, // Pass the ID, render button in column format
      __original: company, // Keep original for click handlers
    };
  };

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <PageHeader
        title="Danh sách công ty nhập khẩu"
        subtitle={`${total} công ty`}
      />

        {/* Filters */}
        <Box sx={{ mb: 3, display: "flex", gap: 2, flexWrap: "wrap" }}>
          <TextField
            label="Tìm kiếm công ty"
            value={filters.search}
            onChange={(e) => handleFilterChange("search", e.target.value)}
            sx={{ minWidth: 250 }}
            size="small"
          />

          <CategorySelect
            value={filters.category}
            onChange={(value) => handleFilterChange("category", value)}
            label="Danh mục hàng hóa"
          />

          <TextField
            label="Từ ngày"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 180 }}
            size="small"
          />

          <TextField
            label="Đến ngày"
            type="date"
            value={filters.dateTo}
            onChange={(e) => handleFilterChange("dateTo", e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 180 }}
            size="small"
          />

          <TextField
            select
            label="Sắp xếp theo"
            value={filters.sortBy}
            onChange={(e) => handleFilterChange("sortBy", e.target.value)}
            sx={{ minWidth: 200 }}
            size="small"
          >
            <MenuItem value="totalImportValue">Tổng trị giá</MenuItem>
            <MenuItem value="totalQuantity">Tổng số lượng</MenuItem>
            <MenuItem value="totalTransactions">Số giao dịch</MenuItem>
            <MenuItem value="uniqueGoodsCount">Số mặt hàng</MenuItem>
            <MenuItem value="lastTransactionDate">Giao dịch gần nhất</MenuItem>
          </TextField>
        </Box>

        {/* Data Table */}
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error">{error}</Alert>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={companies.map(formatRow)}
              sortBy={filters.sortBy}
              sortDirection={filters.sortOrder}
              onSort={handleSortChange}
              pagination={false}
            />
            <TablePagination
              component="div"
              count={total}
              page={page - 1} // MUI is 0-indexed
              onPageChange={handleChangePage}
              rowsPerPage={pageSize}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[25, 50, 100]}
              labelRowsPerPage="Số dòng mỗi trang:"
              labelDisplayedRows={({ from, to, count }) =>
                `${from}-${to} của ${count !== -1 ? count : `hơn ${to}`}`
              }
            />
          </>
        )}

        {/* Company Detail Modal */}
        <Dialog open={detailOpen} onClose={handleCloseDetail} maxWidth="lg" fullWidth>
        <DialogTitle>
          {selectedCompany && (
            <>
              <Typography variant="h6">{selectedCompany.name}</Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedCompany.address}
              </Typography>
            </>
          )}
        </DialogTitle>
        <DialogContent>
          {selectedCompany && (
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: "flex", gap: 4, mb: 3 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Tổng trị giá nhập khẩu
                  </Typography>
                  <Typography variant="h6">
                    {formatUSD(selectedCompany.totalImportValue)}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Số giao dịch
                  </Typography>
                  <Typography variant="h6">
                    {selectedCompany.totalTransactions.toLocaleString()}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Số mặt hàng
                  </Typography>
                  <Typography variant="h6">
                    {selectedCompany.uniqueGoodsCount.toLocaleString()}
                  </Typography>
                </Box>
              </Box>

              <Typography variant="subtitle1" sx={{ mb: 2, fontWeight: 600 }}>
                Các giao dịch ({detailTransactions.length})
              </Typography>

              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Số tờ khai</TableCell>
                    <TableCell>Ngày</TableCell>
                    <TableCell>Tên hàng</TableCell>
                    <TableCell>Danh mục</TableCell>
                    <TableCell align="right">Số lượng</TableCell>
                    <TableCell align="right">Đơn giá</TableCell>
                    <TableCell align="right">Trị giá</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {detailTransactions.map((tx) => (
                    <TableRow key={tx._id}>
                      <TableCell>{tx.declarationNumber}</TableCell>
                      <TableCell>{formatDate(new Date(tx.date))}</TableCell>
                      <TableCell>
                        <Typography variant="body2" sx={{ maxWidth: 300 }}>
                          {tx.goodsShortName || tx.goodsName}
                        </Typography>
                      </TableCell>
                      <TableCell>{tx.category}</TableCell>
                      <TableCell align="right">
                        {tx.quantity.toLocaleString()} {tx.unit}
                      </TableCell>
                      <TableCell align="right">{formatUSD(tx.unitPrice)}</TableCell>
                      <TableCell align="right">{formatUSD(tx.totalValue)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Container>
  );
}
