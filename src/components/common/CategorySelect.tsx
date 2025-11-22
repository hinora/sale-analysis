import React, { useState, useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  SelectChangeEvent,
} from '@mui/material';

/**
 * Props for CategorySelect component
 */
interface CategorySelectProps {
  /**
   * Selected category value
   */
  value: string;
  /**
   * Callback when category selection changes
   */
  onChange: (category: string) => void;
  /**
   * Label for the select field (default: "Danh mục")
   */
  label?: string;
  /**
   * Disabled state
   */
  disabled?: boolean;
  /**
   * Show "All" option (default: true)
   */
  showAllOption?: boolean;
}

/**
 * CategorySelect Component
 * 
 * Provides dropdown selection for goods categories.
 * Fetches available categories from API on mount.
 * Includes an optional "All categories" option.
 * 
 * @example
 * ```tsx
 * const [category, setCategory] = useState('');
 * 
 * <CategorySelect
 *   value={category}
 *   onChange={setCategory}
 * />
 * ```
 */
export function CategorySelect({
  value,
  onChange,
  label = 'Danh mục',
  disabled = false,
  showAllOption = true,
}: CategorySelectProps) {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch categories on mount
  useEffect(() => {
    const fetchCategories = async () => {
      setLoading(true);
      try {
        const response = await fetch('/api/categories/list');
        if (response.ok) {
          const data = await response.json();
          setCategories(data.categories || []);
        }
      } catch (error) {
        console.error('[CategorySelect] Error fetching categories:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchCategories();
  }, []);

  const handleChange = (event: SelectChangeEvent) => {
    onChange(event.target.value);
  };

  return (
    <FormControl size="small" fullWidth disabled={disabled || loading}>
      <InputLabel>{label}</InputLabel>
      <Select value={value} onChange={handleChange} label={label}>
        {showAllOption && (
          <MenuItem value="">
            <em>Tất cả danh mục</em>
          </MenuItem>
        )}
        {loading ? (
          <MenuItem disabled>
            <CircularProgress size={20} sx={{ mr: 1 }} />
            Đang tải...
          </MenuItem>
        ) : (
          categories.map((category) => (
            <MenuItem key={category} value={category}>
              {category}
            </MenuItem>
          ))
        )}
      </Select>
    </FormControl>
  );
}

export default CategorySelect;
