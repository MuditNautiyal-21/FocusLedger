import type { Style, Fill, Font, Border, Alignment } from 'exceljs';

// ─── Colors ──────────────────────────────────────────────────────────

export const COLORS = {
  dark: '111827',
  white: 'FFFFFF',
  offWhite: 'F8FAFC',
  greenText: '059669',
  greenFillLight: 'D1FAE5',
  greenFill: '10B981',
  redText: 'DC2626',
  redFillLight: 'FEE2E2',
  redFill: 'EF4444',
  grayText: '6B7280',
  grayFillLight: 'F3F4F6',
  yellowFillLight: 'FEF3C7',
  blueFillLight: 'DBEAFE',
  accent: '3B82F6',
};

// ─── Reusable partial styles ─────────────────────────────────────────

const thinBorder: Partial<Border> = { style: 'thin', color: { argb: 'E5E7EB' } };

export const borders = {
  all: {
    top: thinBorder,
    bottom: thinBorder,
    left: thinBorder,
    right: thinBorder,
  },
};

export const headerFont: Partial<Font> = {
  bold: true,
  size: 11,
  color: { argb: COLORS.white },
  name: 'Calibri',
};

export const headerFill: Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: COLORS.dark },
};

export const headerAlignment: Partial<Alignment> = {
  horizontal: 'center',
  vertical: 'middle',
};

export const dataFont: Partial<Font> = {
  size: 10,
  name: 'Calibri',
};

// ─── Full style presets ──────────────────────────────────────────────

export const headerStyle: Partial<Style> = {
  font: headerFont,
  fill: headerFill,
  alignment: headerAlignment,
  border: borders.all,
};

export const dataStyle: Partial<Style> = {
  font: dataFont,
  border: borders.all,
  alignment: { vertical: 'middle' },
};

export const dataStyleAlt: Partial<Style> = {
  ...dataStyle,
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.offWhite } },
};

export const productiveStyle: Partial<Style> = {
  font: { ...dataFont, color: { argb: COLORS.greenText } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.greenFillLight } },
  border: borders.all,
  alignment: { vertical: 'middle' },
};

export const wastedStyle: Partial<Style> = {
  font: { ...dataFont, color: { argb: COLORS.redText } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.redFillLight } },
  border: borders.all,
  alignment: { vertical: 'middle' },
};

export const neutralStyle: Partial<Style> = {
  font: { ...dataFont, color: { argb: COLORS.grayText } },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.grayFillLight } },
  border: borders.all,
  alignment: { vertical: 'middle' },
};

export const totalStyle: Partial<Style> = {
  font: { ...dataFont, bold: true },
  fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.blueFillLight } },
  border: {
    ...borders.all,
    top: { style: 'medium', color: { argb: COLORS.accent } },
  },
  alignment: { vertical: 'middle' },
};

export const titleStyle: Partial<Style> = {
  font: { bold: true, size: 16, name: 'Calibri', color: { argb: COLORS.dark } },
  alignment: { horizontal: 'left', vertical: 'middle' },
};

export const subtitleStyle: Partial<Style> = {
  font: { size: 11, color: { argb: COLORS.grayText }, name: 'Calibri' },
  alignment: { horizontal: 'left', vertical: 'middle' },
};

// ─── Conditional fill helpers ────────────────────────────────────────

export const greenFill: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.greenFillLight } };
export const yellowFill: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.yellowFillLight } };
export const redFill: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.redFillLight } };
