/**
 * Number and date formatting utilities
 * Provides consistent formatting across the application
 */

/**
 * Format number as Vietnamese currency (VND)
 */
export function formatVND(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(value);
}

/**
 * Format number as USD currency
 */
export function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

/**
 * Format number with thousands separator (Vietnamese locale)
 */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat("vi-VN", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format number with unit (e.g., "1,234 kg", "5.67 m³")
 */
export function formatNumberWithUnit(
  value: number,
  unit: string,
  decimals = 2,
): string {
  return `${formatNumber(value, decimals)} ${unit}`;
}

/**
 * Format large numbers with K, M, B suffixes
 */
export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(1)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}K`;
  }
  return value.toString();
}

/**
 * Format date in Vietnamese format (DD/MM/YYYY)
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Format date with time (DD/MM/YYYY HH:mm:ss)
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(d);
}

/**
 * Format date as relative time (e.g., "2 ngày trước", "5 giờ trước")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const months = Math.floor(days / 30);
  const years = Math.floor(months / 12);

  if (years > 0) return `${years} năm trước`;
  if (months > 0) return `${months} tháng trước`;
  if (days > 0) return `${days} ngày trước`;
  if (hours > 0) return `${hours} giờ trước`;
  if (minutes > 0) return `${minutes} phút trước`;
  return "Vừa xong";
}

/**
 * Format month-year (MM/YYYY)
 */
export function formatMonthYear(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("vi-VN", {
    year: "numeric",
    month: "2-digit",
  }).format(d);
}

/**
 * Format date range
 */
export function formatDateRange(
  from: Date | string,
  to: Date | string,
): string {
  return `${formatDate(from)} - ${formatDate(to)}`;
}

/**
 * Format percentage
 */
export function formatPercentage(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format file size (bytes to KB, MB, GB)
 */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1_073_741_824) {
    return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
  }
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(2)} MB`;
  }
  if (bytes >= 1_024) {
    return `${(bytes / 1_024).toFixed(2)} KB`;
  }
  return `${bytes} bytes`;
}

/**
 * Parse Vietnamese date string (DD/MM/YYYY) to Date object
 */
export function parseVietnameseDate(dateString: string): Date | null {
  const parts = dateString.split("/");
  if (parts.length !== 3) return null;

  const day = Number.parseInt(parts[0], 10);
  const month = Number.parseInt(parts[1], 10) - 1; // Month is 0-indexed
  const year = Number.parseInt(parts[2], 10);

  if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) {
    return null;
  }

  const date = new Date(year, month, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month ||
    date.getDate() !== day
  ) {
    return null; // Invalid date
  }

  return date;
}
