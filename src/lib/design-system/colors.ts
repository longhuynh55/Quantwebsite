/**
 * QuantVN Extended Color System
 * Professional financial color palette for desktop UI
 */

// Primary Blues - Deep range for visual hierarchy
export const primaryColors = {
  50: '#eff6ff',
  100: '#dbeafe',
  200: '#bfdbfe',
  300: '#93c5fd',
  400: '#60a5fa',
  500: '#3b82f6',
  600: '#2563eb',
  700: '#1d4ed8',
  800: '#1e40af',
  900: '#1e3a8a',
  950: '#172554',
} as const;

// Accent Teal - Financial growth indicator
export const accentColors = {
  50: '#f0fdfa',
  100: '#ccfbf1',
  200: '#99f6e4',
  300: '#5eead4',
  400: '#2dd4bf',
  500: '#14b8a6',
  600: '#0d9488',
  700: '#0f766e',
  800: '#115e59',
  900: '#134e4a',
} as const;

// Success Green - Positive values, gains
export const successColors = {
  50: '#f0fdf4',
  100: '#dcfce7',
  200: '#bbf7d0',
  300: '#86efac',
  400: '#4ade80',
  500: '#22c55e',
  600: '#16a34a',
  700: '#15803d',
  800: '#166534',
  900: '#14532d',
} as const;

// Danger Red - Negative values, losses
export const dangerColors = {
  50: '#fef2f2',
  100: '#fee2e2',
  200: '#fecaca',
  300: '#fca5a5',
  400: '#f87171',
  500: '#ef4444',
  600: '#dc2626',
  700: '#b91c1c',
  800: '#991b1b',
  900: '#7f1d1d',
} as const;

// Warning Orange - Caution states
export const warningColors = {
  50: '#fff7ed',
  100: '#ffedd5',
  200: '#fed7aa',
  300: '#fdba74',
  400: '#fb923c',
  500: '#f97316',
  600: '#ea580c',
  700: '#c2410c',
  800: '#9a3412',
  900: '#7c2d12',
} as const;

// Chart Series Palette - 10 distinct colors for multi-series charts
export const chartSeriesColors = {
  // Ordered for optimal differentiation
  series1: '#2563eb', // Primary blue
  series2: '#16a34a', // Green
  series3: '#dc2626', // Red
  series4: '#f97316', // Orange
  series5: '#8b5cf6', // Purple
  series6: '#14b8a6', // Teal
  series7: '#ec4899', // Pink
  series8: '#eab308', // Yellow
  series9: '#06b6d4', // Cyan
  series10: '#64748b', // Slate
} as const;

// Semantic Chart Colors - For specific chart contexts
export const chartSemanticColors = {
  // Bullish/Bearish
  bullish: '#16a34a',
  bearish: '#dc2626',
  neutral: '#64748b',

  // Performance
  outperform: '#16a34a',
  underperform: '#dc2626',
  benchmark: '#64748b',

  // Volume
  volumeUp: '#22c55e',
  volumeDown: '#ef4444',
  volumeNeutral: '#94a3b8',

  // Volatility
  lowVolatility: '#22c55e',
  mediumVolatility: '#f97316',
  highVolatility: '#ef4444',
} as const;

// Diverging Scale - For positive/negative value gradients
export const divergingScale = {
  // Positive side (green)
  positive5: '#166534',
  positive4: '#15803d',
  positive3: '#16a34a',
  positive2: '#22c55e',
  positive1: '#86efac',

  // Neutral
  neutral: '#f8fafc',

  // Negative side (red)
  negative1: '#fca5a5',
  negative2: '#f87171',
  negative3: '#ef4444',
  negative4: '#dc2626',
  negative5: '#b91c1c',
} as const;

// Status Colors - For live data indicators
export const statusColors = {
  live: {
    bg: '#dcfce7',
    text: '#166534',
    pulse: '#22c55e',
  },
  stale: {
    bg: '#fef9c3',
    text: '#854d0e',
    pulse: '#eab308',
  },
  error: {
    bg: '#fee2e2',
    text: '#991b1b',
    pulse: '#ef4444',
  },
  loading: {
    bg: '#dbeafe',
    text: '#1e40af',
    pulse: '#3b82f6',
  },
} as const;

// Neutral Grays - For UI elements
export const grayColors = {
  50: '#f8fafc',
  100: '#f1f5f9',
  200: '#e2e8f0',
  300: '#cbd5e1',
  400: '#94a3b8',
  500: '#64748b',
  600: '#475569',
  700: '#334155',
  800: '#1e293b',
  900: '#0f172a',
  950: '#020617',
} as const;

// Dark Mode Variants
export const darkModeColors = {
  background: '#0f172a',
  surface: '#1e293b',
  surfaceHover: '#334155',
  border: '#334155',
  textPrimary: '#f1f5f9',
  textSecondary: '#94a3b8',
  textMuted: '#64748b',

  // Chart colors adjusted for dark mode
  chartGrid: '#334155',
  chartAxis: '#64748b',
  chartTooltip: {
    bg: 'rgba(30, 41, 59, 0.95)',
    border: '#475569',
    text: '#f1f5f9',
  },
} as const;

// Glass Morphism Colors
export const glassColors = {
  light: {
    bg: 'rgba(255, 255, 255, 0.85)',
    border: 'rgba(255, 255, 255, 0.2)',
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
  dark: {
    bg: 'rgba(15, 23, 42, 0.85)',
    border: 'rgba(255, 255, 255, 0.1)',
    shadow: 'rgba(0, 0, 0, 0.3)',
  },
} as const;

// Utility functions
export function getChartSeriesColor(index: number): string {
  const colors = Object.values(chartSeriesColors);
  return colors[index % colors.length];
}

export function getDivergingColor(value: number, min: number, max: number): string {
  // Normalize value to 0-1 range
  const normalized = (value - min) / (max - min);

  const colors = Object.values(divergingScale);
  const index = Math.round(normalized * (colors.length - 1));
  return colors[Math.max(0, Math.min(colors.length - 1, index))];
}

export function getTrendColor(trend: 'up' | 'down' | 'neutral'): string {
  switch (trend) {
    case 'up':
      return successColors[600];
    case 'down':
      return dangerColors[600];
    default:
      return grayColors[500];
  }
}

export function getStatusColor(status: 'live' | 'stale' | 'error' | 'loading'): (typeof statusColors)[keyof typeof statusColors] {
  return statusColors[status];
}

// Export all color collections
export const colors = {
  primary: primaryColors,
  accent: accentColors,
  success: successColors,
  danger: dangerColors,
  warning: warningColors,
  gray: grayColors,
  chartSeries: chartSeriesColors,
  chartSemantic: chartSemanticColors,
  diverging: divergingScale,
  status: statusColors,
  darkMode: darkModeColors,
  glass: glassColors,
} as const;

export type ColorScale = typeof primaryColors;
export type ChartSeriesColor = keyof typeof chartSeriesColors;
export type StatusType = keyof typeof statusColors;
export type TrendType = 'up' | 'down' | 'neutral';
