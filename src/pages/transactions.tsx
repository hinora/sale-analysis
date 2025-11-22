import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import {
  Container,
  Paper,
  Box,
  Grid,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Alert,
  TablePagination,
} from '@mui/material';
import { Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';
import PageHeader from '@/components/layout/PageHeader';
import DataTable from '@/components/tables/DataTable';
import DateRangePicker from '@/components/common/DateRangePicker';
import CompanyAutocomplete from '@/components/common/CompanyAutocomplete';
import CategorySelect from '@/components/common/CategorySelect';
import { formatVND, formatUSD, formatDate } from '@/lib/utils/formatting';

/**
 * Transaction data from API
 */
interface Transaction {
  _id: string;
  declarationNumber: string;
  date: string;
  company: {
    _id: string;
    name: string;
    taxCode: string;
  };
  goods: {
    _id: string;
    rawName: string;
    shortName: string;
    category: string;
  };
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  currency: string;
  hsCode?: string;
}

/**
 * Filter state
 */
interface FilterState {
  company: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  category: string;
  goods: string;
}

/**
 * Transactions Page
 * 
 * Displays a filterable, sortable, paginated list of all transactions.
 * Supports filtering by company name, date range, goods category, and goods name.
 * URL query parameters preserve filter and pagination state.
 */
export default function TransactionsPage() {
  const router = useRouter();

  // Parse URL query parameters for initial state
  const getInitialFilters = (): FilterState => ({
    company: (router.query.company as string) || '',
    dateFrom: router.query.dateFrom ? new Date(router.query.dateFrom as string) : null,
    dateTo: router.query.dateTo ? new Date(router.query.dateTo as string) : null,
    category: (router.query.category as string) || '',
    goods: (router.query.goods as string) || '',
  });

  const [filters, setFilters] = useState<FilterState>(getInitialFilters());
  const [page, setPage] = useState(parseInt(router.query.page as string) || 1);
  const [pageSize, setPageSize] = useState(parseInt(router.query.pageSize as string) || 50);
  const [sortBy, setSortBy] = useState((router.query.sortBy as string) || 'date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>((router.query.sortOrder as 'asc' | 'desc') || 'desc');

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update URL when filters change
  useEffect(() => {
    const query: Record<string, string> = {};

    if (filters.company) query.company = filters.company;
    if (filters.dateFrom) query.dateFrom = filters.dateFrom.toISOString().split('T')[0];
    if (filters.dateTo) query.dateTo = filters.dateTo.toISOString().split('T')[0];
    if (filters.category) query.category = filters.category;
    if (filters.goods) query.goods = filters.goods;
    if (page > 1) query.page = page.toString();
    if (pageSize !== 50) query.pageSize = pageSize.toString();
    if (sortBy !== 'date') query.sortBy = sortBy;
    if (sortOrder !== 'desc') query.sortOrder = sortOrder;

    router.replace(
      {
        pathname: router.pathname,
        query,
      },
      undefined,
      { shallow: true }
    );
  }, [filters, page, pageSize, sortBy, sortOrder, router]);

  // Fetch transactions
  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const queryParams = new URLSearchParams({
        page: page.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
      });

      if (filters.company) queryParams.append('company', filters.company);
      if (filters.dateFrom) queryParams.append('dateFrom', filters.dateFrom.toISOString());
      if (filters.dateTo) queryParams.append('dateTo', filters.dateTo.toISOString());
      if (filters.category) queryParams.append('category', filters.category);
      if (filters.goods) queryParams.append('goods', filters.goods);

      const response = await fetch(`/api/transactions/list?${queryParams}`);

      if (!response.ok) {
        throw new Error('Failed to fetch transactions');
      }

      const data = await response.json();
      setTransactions(data.transactions);
      setTotal(data.total);
    } catch (err) {
      console.error('[TransactionsPage] Error fetching transactions:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize, sortBy, sortOrder]);

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchTransactions();
  }, [fetchTransactions]);

  // Handle filter changes
  const handleFilterChange = (key: keyof FilterState, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page on filter change
  };

  // Handle clear filters
  const handleClearFilters = () => {
    setFilters({
      company: '',
      dateFrom: null,
      dateTo: null,
      category: '',
      goods: '',
    });
    setPage(1);
  };

  // Handle pagination
  const handleChangePage = (_: unknown, newPage: number) => {
    setPage(newPage + 1); // MUI TablePagination is 0-indexed
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setPageSize(parseInt(event.target.value, 10));
    setPage(1);
  };

  // Handle sorting
  const handleSort = (field: string, direction: 'asc' | 'desc') => {
    setSortBy(field);
    setSortOrder(direction);
  };

  // Table columns
  const columns = [
    { id: 'declarationNumber', label: 'Số tờ khai', width: 150, sortable: true },
    { id: 'date', label: 'Ngày tờ khai', width: 120, sortable: true },
    { id: 'company.name', label: 'Công ty', width: 200, sortable: true },
    { id: 'goods.shortName', label: 'Hàng hóa', width: 250, sortable: true },
    { id: 'goods.category', label: 'Danh mục', width: 150, sortable: true },
    { id: 'quantity', label: 'Số lượng', width: 100, sortable: true, align: 'right' as const },
    { id: 'unit', label: 'Đơn vị', width: 80, sortable: false },
    { id: 'unitPrice', label: 'Đơn giá', width: 120, sortable: true, align: 'right' as const },
    { id: 'totalValue', label: 'Tổng trị giá', width: 150, sortable: true, align: 'right' as const },
  ];

  // Format row data
  const formatRow = (tx: Transaction) => {
    const formatCurrency = (value: number, currency: string) => {
      return currency === 'VND' ? formatVND(value) : formatUSD(value);
    };

    const formatDateSafe = (dateString: string) => {
      if (!dateString) return '-';
      const date = new Date(dateString);
      return Number.isNaN(date.getTime()) ? '-' : formatDate(date);
    };

    return {
      declarationNumber: tx.declarationNumber,
      date: formatDateSafe(tx.date),
      'company.name': tx.company.name,
      'goods.shortName': tx.goods.shortName,
      'goods.category': tx.goods.category,
      quantity: tx.quantity.toLocaleString('vi-VN'),
      unit: tx.unit,
      unitPrice: formatCurrency(tx.unitPrice, tx.currency),
      totalValue: formatCurrency(tx.totalValue, tx.currency),
    };
  };

  return (
    <Container maxWidth="xl">
      <PageHeader
        title="Giao dịch"
        subtitle={`Tổng số: ${total.toLocaleString('vi-VN')} giao dịch`}
      />

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Bộ lọc
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <CompanyAutocomplete
              value={filters.company}
              onChange={(value) => handleFilterChange('company', value)}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <CategorySelect
              value={filters.category}
              onChange={(value) => handleFilterChange('category', value)}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              label="Hàng hóa"
              placeholder="Tìm kiếm hàng hóa..."
              value={filters.goods}
              onChange={(e) => handleFilterChange('goods', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={8}>
            <DateRangePicker
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              onDateFromChange={(date) => handleFilterChange('dateFrom', date)}
              onDateToChange={(date) => handleFilterChange('dateTo', date)}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end', height: '100%', alignItems: 'center' }}>
              <Button
                variant="outlined"
                startIcon={<ClearIcon />}
                onClick={handleClearFilters}
              >
                Xóa bộ lọc
              </Button>
              <Button
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={() => fetchTransactions()}
              >
                Tìm kiếm
              </Button>
            </Box>
          </Grid>
        </Grid>
      </Paper>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {/* Data Table */}
      <Paper>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={transactions.map(formatRow)}
              sortBy={sortBy}
              sortDirection={sortOrder}
              onSort={handleSort}
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
      </Paper>
    </Container>
  );
}
