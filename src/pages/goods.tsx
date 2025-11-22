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
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  Visibility as VisibilityIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import PageHeader from '@/components/layout/PageHeader';
import DataTable from '@/components/tables/DataTable';
import { DateRangePicker } from '@/components/common/DateRangePicker';
import { CompanyAutocomplete } from '@/components/common/CompanyAutocomplete';
import { CategorySelect } from '@/components/common/CategorySelect';
import { formatVND, formatUSD, formatDate } from '@/lib/utils/formatting';

/**
 * Goods data with aggregated metrics
 */
interface GoodsItem {
  _id: string;
  rawName: string;
  shortName: string;
  category: string;
  hsCode: string;
  totalQuantityExported: number;
  totalValueExported: number;
  transactionCount: number;
  averagePrice: number;
  lastExportDate: string;
}

/**
 * Transaction data for goods detail
 */
interface Transaction {
  _id: string;
  declarationNumber: string;
  date: string;
  company: {
    _id: string;
    name: string;
    address: string;
  };
  quantity: number;
  unit: string;
  unitPrice: number;
  totalValue: number;
  hsCode: string;
}

/**
 * Goods detail data
 */
interface GoodsDetail {
  goods: {
    _id: string;
    rawName: string;
    shortName: string;
    category: string;
    hsCode: string;
    classifiedBy: string;
    classifiedAt: string;
    totalQuantityExported: number;
    totalValueExported: number;
    transactionCount: number;
    averagePrice: number;
  };
  transactions: Transaction[];
}

/**
 * Filter state
 */
interface FilterState {
  company: string;
  dateFrom: Date | null;
  dateTo: Date | null;
  category: string;
  search: string;
}

/**
 * Goods Catalog Page
 * 
 * Displays a product-centric view with aggregated export statistics.
 * Supports filtering by company, date range, and category.
 * Enables sorting by aggregated metrics and drill-down to transaction details.
 */
export default function GoodsPage() {
  const router = useRouter();

  // Parse URL query parameters for initial state
  const getInitialFilters = (): FilterState => ({
    company: (router.query.company as string) || '',
    dateFrom: router.query.dateFrom ? new Date(router.query.dateFrom as string) : null,
    dateTo: router.query.dateTo ? new Date(router.query.dateTo as string) : null,
    category: (router.query.category as string) || '',
    search: (router.query.search as string) || '',
  });

  const [filters, setFilters] = useState<FilterState>(getInitialFilters());
  const [page, setPage] = useState(parseInt(router.query.page as string) || 1);
  const [pageSize, setPageSize] = useState(parseInt(router.query.pageSize as string) || 50);
  const [sortBy, setSortBy] = useState((router.query.sortBy as string) || 'totalValueExported');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>(
    (router.query.sortOrder as 'asc' | 'desc') || 'desc'
  );

  const [goods, setGoods] = useState<GoodsItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Detail modal state
  const [selectedGoods, setSelectedGoods] = useState<GoodsDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);

  // Update URL when filters change
  useEffect(() => {
    const query: Record<string, string> = {};

    if (filters.company) query.company = filters.company;
    if (filters.dateFrom) query.dateFrom = filters.dateFrom.toISOString().split('T')[0];
    if (filters.dateTo) query.dateTo = filters.dateTo.toISOString().split('T')[0];
    if (filters.category) query.category = filters.category;
    if (filters.search) query.search = filters.search;
    if (page > 1) query.page = page.toString();
    if (pageSize !== 50) query.pageSize = pageSize.toString();
    if (sortBy !== 'totalValueExported') query.sortBy = sortBy;
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

  // Fetch goods
  const fetchGoods = useCallback(async () => {
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
      if (filters.search) queryParams.append('search', filters.search);

      const response = await fetch(`/api/goods/list?${queryParams}`);

      if (!response.ok) {
        throw new Error('Failed to fetch goods');
      }

      const data = await response.json();
      setGoods(data.goods);
      setTotal(data.total);
    } catch (err) {
      console.error('[GoodsPage] Error fetching goods:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, [filters, page, pageSize, sortBy, sortOrder]);

  // Fetch goods detail
  const fetchGoodsDetail = async (goodsId: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/goods/${goodsId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch goods detail');
      }
      const data = await response.json();
      setSelectedGoods(data);
      setDetailOpen(true);
    } catch (err) {
      console.error('[GoodsPage] Error fetching goods detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to load detail');
    } finally {
      setDetailLoading(false);
    }
  };

  // Fetch on mount and when dependencies change
  useEffect(() => {
    fetchGoods();
  }, [fetchGoods]);

  // Handle filter changes
  const handleFilterChange = (key: keyof FilterState, value: string | Date | null) => {
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
      search: '',
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

  // Handle row click to view detail
  const handleViewDetail = (goodsId: string) => {
    fetchGoodsDetail(goodsId);
  };

  // Close detail modal
  const handleCloseDetail = () => {
    setDetailOpen(false);
    setSelectedGoods(null);
  };

  // Table columns
  const columns = [
    { id: 'shortName', label: 'Tên hàng hóa', minWidth: 250, sortable: true },
    { id: 'category', label: 'Danh mục', minWidth: 150, sortable: true },
    { id: 'hsCode', label: 'Mã HS', minWidth: 100, sortable: true },
    {
      id: 'transactionCount',
      label: 'Số giao dịch',
      minWidth: 120,
      sortable: true,
      align: 'right' as const,
    },
    {
      id: 'totalQuantityExported',
      label: 'Tổng số lượng',
      minWidth: 130,
      sortable: true,
      align: 'right' as const,
    },
    {
      id: 'totalValueExported',
      label: 'Tổng trị giá (USD)',
      minWidth: 150,
      sortable: true,
      align: 'right' as const,
    },
    {
      id: 'averagePrice',
      label: 'Giá trung bình',
      minWidth: 130,
      sortable: true,
      align: 'right' as const,
    },
    { id: 'lastExportDate', label: 'Xuất gần nhất', minWidth: 130, sortable: true },
    {
      id: 'actions',
      label: 'Thao tác',
      minWidth: 100,
      sortable: false,
      align: 'center' as const,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      format: (_value: any, row: any) => {
        const original = row.__original as GoodsItem;
        return (
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleViewDetail(original._id)}
            disabled={detailLoading}
          >
            <VisibilityIcon />
          </IconButton>
        );
      },
    },
  ];

  // Format row data
  const formatRow = (item: GoodsItem) => {
    const formatted: Record<string, string | number> = {
      _id: item._id,
      shortName: item.shortName,
      category: item.category,
      hsCode: item.hsCode,
      transactionCount: item.transactionCount.toLocaleString('vi-VN'),
      totalQuantityExported: item.totalQuantityExported.toLocaleString('vi-VN', {
        maximumFractionDigits: 2,
      }),
      totalValueExported: formatUSD(item.totalValueExported),
      averagePrice: formatUSD(item.averagePrice),
      lastExportDate: item.lastExportDate ? formatDate(new Date(item.lastExportDate)) : '-',
      actions: '', // Empty string, will be rendered by format function
    };
    // Add original item data for format function access
    return Object.assign(formatted, { __original: item });
  };

  return (
    <Container maxWidth="xl">
      <PageHeader
        title="Danh mục hàng hóa"
        subtitle={`Tổng số: ${total.toLocaleString('vi-VN')} mặt hàng`}
      />

      {/* Filters */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Bộ lọc
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              label="Tìm kiếm hàng hóa"
              placeholder="Nhập tên hàng hóa..."
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <CategorySelect
              value={filters.category}
              onChange={(value) => handleFilterChange('category', value)}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <CompanyAutocomplete
              value={filters.company}
              onChange={(value) => handleFilterChange('company', value)}
            />
          </Grid>
          <Grid item xs={12} md={8}>
            <DateRangePicker
              dateFrom={filters.dateFrom}
              dateTo={filters.dateTo}
              onDateFromChange={(date) => handleFilterChange('dateFrom', date)}
              onDateToChange={(date) => handleFilterChange('dateTo', date)}
              fromLabel="Từ ngày xuất"
              toLabel="Đến ngày xuất"
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Box
              sx={{
                display: 'flex',
                gap: 2,
                justifyContent: 'flex-end',
                height: '100%',
                alignItems: 'center',
              }}
            >
              <Button variant="outlined" startIcon={<ClearIcon />} onClick={handleClearFilters}>
                Xóa bộ lọc
              </Button>
              <Button
                variant="contained"
                startIcon={<SearchIcon />}
                onClick={() => fetchGoods()}
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
              rows={goods.map(formatRow)}
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

      {/* Goods Detail Modal */}
      <Dialog open={detailOpen} onClose={handleCloseDetail} maxWidth="lg" fullWidth>
        {selectedGoods && (
          <>
            <DialogTitle>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6">{selectedGoods.goods.shortName}</Typography>
                <IconButton onClick={handleCloseDetail} size="small">
                  <CloseIcon />
                </IconButton>
              </Box>
            </DialogTitle>
            <DialogContent dividers>
              {/* Goods Summary */}
              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Tên đầy đủ
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedGoods.goods.rawName}
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    Danh mục
                  </Typography>
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {selectedGoods.goods.category}
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    Mã HS
                  </Typography>
                  <Typography variant="body1">{selectedGoods.goods.hsCode}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="body2" color="text.secondary">
                    Tổng số lượng xuất
                  </Typography>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    {selectedGoods.goods.totalQuantityExported.toLocaleString('vi-VN', {
                      maximumFractionDigits: 2,
                    })}
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    Tổng trị giá
                  </Typography>
                  <Typography variant="h6" sx={{ mb: 2 }}>
                    {formatUSD(selectedGoods.goods.totalValueExported)}
                  </Typography>

                  <Typography variant="body2" color="text.secondary">
                    Số giao dịch
                  </Typography>
                  <Typography variant="h6">
                    {selectedGoods.goods.transactionCount.toLocaleString('vi-VN')}
                  </Typography>
                </Grid>
              </Grid>

              {/* Transactions Table */}
              <Typography variant="h6" gutterBottom>
                Giao dịch
              </Typography>
              <DataTable
                columns={[
                  { id: 'declarationNumber', label: 'Số tờ khai', minWidth: 150 },
                  { id: 'date', label: 'Ngày', minWidth: 120 },
                  { id: 'company', label: 'Công ty', minWidth: 200 },
                  { id: 'quantity', label: 'Số lượng', minWidth: 100, align: 'right' as const },
                  { id: 'unitPrice', label: 'Đơn giá', minWidth: 120, align: 'right' as const },
                  { id: 'totalValue', label: 'Trị giá', minWidth: 120, align: 'right' as const },
                ]}
                rows={selectedGoods.transactions.map((tx) => ({
                  declarationNumber: tx.declarationNumber,
                  date: formatDate(new Date(tx.date)),
                  company: tx.company.name,
                  quantity: tx.quantity.toLocaleString('vi-VN'),
                  unitPrice: formatUSD(tx.unitPrice),
                  totalValue: formatUSD(tx.totalValue),
                }))}
                pagination={false}
                maxHeight={400}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={handleCloseDetail}>Đóng</Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Container>
  );
}
