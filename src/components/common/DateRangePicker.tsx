import React from "react";
import { Box, TextField } from "@mui/material";

/**
 * Props for DateRangePicker component
 */
interface DateRangePickerProps {
  /**
   * Start date value
   */
  dateFrom: Date | null;
  /**
   * End date value
   */
  dateTo: Date | null;
  /**
   * Callback when start date changes
   */
  onDateFromChange: (date: Date | null) => void;
  /**
   * Callback when end date changes
   */
  onDateToChange: (date: Date | null) => void;
  /**
   * Label for start date picker (default: "Từ ngày")
   */
  fromLabel?: string;
  /**
   * Label for end date picker (default: "Đến ngày")
   */
  toLabel?: string;
  /**
   * Disabled state
   */
  disabled?: boolean;
}

/**
 * DateRangePicker Component
 *
 * Provides two date pickers for selecting a date range.
 * Uses native HTML5 date inputs with MUI TextField styling.
 *
 * @example
 * ```tsx
 * const [dateFrom, setDateFrom] = useState<Date | null>(null);
 * const [dateTo, setDateTo] = useState<Date | null>(null);
 *
 * <DateRangePicker
 *   dateFrom={dateFrom}
 *   dateTo={dateTo}
 *   onDateFromChange={setDateFrom}
 *   onDateToChange={setDateTo}
 * />
 * ```
 */
export default function DateRangePicker({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  fromLabel = "Từ ngày",
  toLabel = "Đến ngày",
  disabled = false,
}: DateRangePickerProps) {
  const formatDateForInput = (date: Date | null) => {
    if (!date) return "";
    return date.toISOString().split("T")[0];
  };

  const parseDateFromInput = (value: string) => {
    if (!value) return null;
    return new Date(value);
  };

  return (
    <Box sx={{ display: "flex", gap: 2 }}>
      <TextField
        type="date"
        label={fromLabel}
        value={formatDateForInput(dateFrom)}
        onChange={(e) => onDateFromChange(parseDateFromInput(e.target.value))}
        disabled={disabled}
        size="small"
        fullWidth
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        type="date"
        label={toLabel}
        value={formatDateForInput(dateTo)}
        onChange={(e) => onDateToChange(parseDateFromInput(e.target.value))}
        disabled={disabled}
        size="small"
        fullWidth
        InputLabelProps={{ shrink: true }}
        inputProps={{
          min: formatDateForInput(dateFrom),
        }}
      />
    </Box>
  );
}
