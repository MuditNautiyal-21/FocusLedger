import ExcelJS from 'exceljs';
import { getDb } from '../database/connection';
import {
  headerStyle,
  dataStyle,
  dataStyleAlt,
  productiveStyle,
  wastedStyle,
  neutralStyle,
  totalStyle,
  titleStyle,
  subtitleStyle,
  greenFill,
  yellowFill,
  redFill,
  borders,
  COLORS,
} from './templates';
import type { Activity, ActivityRow, Classification } from '../../shared/types';

// ─── Helpers ─────────────────────────────────────────────────────────

function activityFromRow(row: ActivityRow): Activity {
  return { ...row, was_prompted: row.was_prompted === 1 };
}

function fmtHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtDuration(seconds: number): string {
  if (seconds >= 3600) return fmtHMS(seconds);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function fmtTime12(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' });
}

function daysBetween(start: string, end: string): string[] {
  const days: string[] = [];
  const d = new Date(start + 'T12:00:00');
  const e = new Date(end + 'T12:00:00');
  while (d <= e) {
    days.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function applyStyleToRow(row: ExcelJS.Row, style: Partial<ExcelJS.Style>): void {
  row.eachCell({ includeEmpty: true }, (cell) => {
    if (style.font) cell.font = style.font as ExcelJS.Font;
    if (style.fill) cell.fill = style.fill as ExcelJS.Fill;
    if (style.alignment) cell.alignment = style.alignment as Partial<ExcelJS.Alignment>;
    if (style.border) cell.border = style.border as Partial<ExcelJS.Borders>;
  });
}

function classStyle(cls: Classification): Partial<ExcelJS.Style> {
  if (cls === 'productive') return productiveStyle;
  if (cls === 'non-productive') return wastedStyle;
  return neutralStyle;
}

// ─── Data fetching ───────────────────────────────────────────────────

interface DaySummary {
  date: string;
  totalSeconds: number;
  productiveSeconds: number;
  wastedSeconds: number;
  neutralSeconds: number;
  score: number;
  topProdApp: string;
  topWasteApp: string;
}

function fetchActivitiesForRange(start: string, end: string): Activity[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM activities
    WHERE started_at >= ? AND started_at <= ?
    ORDER BY started_at ASC
  `).all(start + 'T00:00:00.000Z', end + 'T23:59:59.999Z') as ActivityRow[];
  return rows.map(activityFromRow);
}

function computeDaySummaries(activities: Activity[], days: string[]): DaySummary[] {
  return days.map((date) => {
    const dayActs = activities.filter((a) => a.started_at.startsWith(date));
    const total = dayActs.reduce((s, a) => s + a.duration_seconds, 0);
    const prod = dayActs.filter((a) => a.classification === 'productive').reduce((s, a) => s + a.duration_seconds, 0);
    const waste = dayActs.filter((a) => a.classification === 'non-productive').reduce((s, a) => s + a.duration_seconds, 0);
    const neut = dayActs.filter((a) => a.classification === 'neutral').reduce((s, a) => s + a.duration_seconds, 0);

    // Top apps
    const appDurations = new Map<string, { prod: number; waste: number }>();
    for (const a of dayActs) {
      const d = appDurations.get(a.app_name) || { prod: 0, waste: 0 };
      if (a.classification === 'productive') d.prod += a.duration_seconds;
      if (a.classification === 'non-productive') d.waste += a.duration_seconds;
      appDurations.set(a.app_name, d);
    }
    let topProd = '', topWaste = '', topProdTime = 0, topWasteTime = 0;
    for (const [app, d] of appDurations) {
      if (d.prod > topProdTime) { topProdTime = d.prod; topProd = app; }
      if (d.waste > topWasteTime) { topWasteTime = d.waste; topWaste = app; }
    }

    return {
      date,
      totalSeconds: total,
      productiveSeconds: prod,
      wastedSeconds: waste,
      neutralSeconds: neut,
      score: total > 0 ? Math.round((prod / total) * 100 * 10) / 10 : 0,
      topProdApp: topProd || '—',
      topWasteApp: topWaste || '—',
    };
  });
}

// ─── ExcelReportBuilder ──────────────────────────────────────────────

export class ExcelReportBuilder {
  async generateReport(
    dateRange: { start: string; end: string },
    outputPath: string,
  ): Promise<string> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'FocusLedger';
    wb.created = new Date();

    const days = daysBetween(dateRange.start, dateRange.end);
    const activities = fetchActivitiesForRange(dateRange.start, dateRange.end);
    const summaries = computeDaySummaries(activities, days);

    this.buildDailySummary(wb, summaries);
    this.buildActivityLog(wb, activities);
    this.buildAnalytics(wb, activities, summaries, dateRange);
    if (days.length > 1) {
      this.buildWeeklyTrends(wb, summaries);
    }

    await wb.xlsx.writeFile(outputPath);
    console.log(`[Export] Report saved: ${outputPath}`);
    return outputPath;
  }

  // ── Sheet 1: Daily Summary ──────────────────────────────────────

  private buildDailySummary(wb: ExcelJS.Workbook, summaries: DaySummary[]): void {
    const ws = wb.addWorksheet('Daily Summary');

    // Columns
    ws.columns = [
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Total Active', key: 'total', width: 14 },
      { header: 'Productive', key: 'productive', width: 14 },
      { header: 'Non-Productive', key: 'wasted', width: 16 },
      { header: 'Neutral', key: 'neutral', width: 14 },
      { header: 'Productivity %', key: 'score', width: 16 },
      { header: 'Top Productive App', key: 'topProd', width: 22 },
      { header: 'Top Time Waster', key: 'topWaste', width: 22 },
    ];

    // Header style
    const headerRow = ws.getRow(1);
    applyStyleToRow(headerRow, headerStyle);
    headerRow.height = 24;

    // Data rows
    let totalAll = 0, totalProd = 0, totalWaste = 0, totalNeut = 0;
    for (let i = 0; i < summaries.length; i++) {
      const s = summaries[i];
      totalAll += s.totalSeconds;
      totalProd += s.productiveSeconds;
      totalWaste += s.wastedSeconds;
      totalNeut += s.neutralSeconds;

      const row = ws.addRow({
        date: s.date,
        total: fmtHMS(s.totalSeconds),
        productive: fmtHMS(s.productiveSeconds),
        wasted: fmtHMS(s.wastedSeconds),
        neutral: fmtHMS(s.neutralSeconds),
        score: s.score,
        topProd: s.topProdApp,
        topWaste: s.topWasteApp,
      });

      const style = i % 2 === 0 ? dataStyle : dataStyleAlt;
      applyStyleToRow(row, style);

      // Productive column fill
      row.getCell('productive').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.greenFillLight } } as ExcelJS.Fill;
      // Wasted column fill
      row.getCell('wasted').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.redFillLight } } as ExcelJS.Fill;

      // Productivity % conditional fill
      const scoreCell = row.getCell('score');
      if (s.score >= 70) scoreCell.fill = greenFill as ExcelJS.Fill;
      else if (s.score >= 40) scoreCell.fill = yellowFill as ExcelJS.Fill;
      else scoreCell.fill = redFill as ExcelJS.Fill;
    }

    // Totals row
    const totalScore = totalAll > 0 ? Math.round((totalProd / totalAll) * 100 * 10) / 10 : 0;
    const totRow = ws.addRow({
      date: 'TOTALS',
      total: fmtHMS(totalAll),
      productive: fmtHMS(totalProd),
      wasted: fmtHMS(totalWaste),
      neutral: fmtHMS(totalNeut),
      score: totalScore,
      topProd: '',
      topWaste: '',
    });
    applyStyleToRow(totRow, totalStyle);

    // Freeze header
    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }

  // ── Sheet 2: Activity Log ───────────────────────────────────────

  private buildActivityLog(wb: ExcelJS.Workbook, activities: Activity[]): void {
    const ws = wb.addWorksheet('Activity Log');

    ws.columns = [
      { header: '#', key: 'num', width: 6 },
      { header: 'Start Time', key: 'start', width: 16 },
      { header: 'End Time', key: 'end', width: 16 },
      { header: 'Duration', key: 'duration', width: 12 },
      { header: 'Application', key: 'app', width: 22 },
      { header: 'Window/Tab Title', key: 'title', width: 50 },
      { header: 'Domain', key: 'domain', width: 25 },
      { header: 'Classification', key: 'cls', width: 16 },
      { header: 'Category', key: 'category', width: 16 },
    ];

    const headerRow = ws.getRow(1);
    applyStyleToRow(headerRow, headerStyle);
    headerRow.height = 24;

    for (let i = 0; i < activities.length; i++) {
      const a = activities[i];
      const row = ws.addRow({
        num: i + 1,
        start: fmtTime12(a.started_at),
        end: a.ended_at ? fmtTime12(a.ended_at) : '—',
        duration: fmtDuration(a.duration_seconds),
        app: a.app_name,
        title: a.window_title ?? '',
        domain: a.domain ?? '',
        cls: a.classification,
        category: a.category ?? '',
      });

      const style = i % 2 === 0 ? dataStyle : dataStyleAlt;
      applyStyleToRow(row, style);

      // Classification cell styling
      const clsCell = row.getCell('cls');
      const cs = classStyle(a.classification);
      if (cs.font) clsCell.font = cs.font as ExcelJS.Font;
      if (cs.fill) clsCell.fill = cs.fill as ExcelJS.Fill;
    }

    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }

  // ── Sheet 3: Analytics ──────────────────────────────────────────

  private buildAnalytics(
    wb: ExcelJS.Workbook,
    activities: Activity[],
    summaries: DaySummary[],
    dateRange: { start: string; end: string },
  ): void {
    const ws = wb.addWorksheet('Analytics');
    ws.columns = [
      { width: 28 }, { width: 18 }, { width: 18 }, { width: 18 }, { width: 18 },
    ];

    // Title
    ws.mergeCells('A1:E1');
    const titleCell = ws.getCell('A1');
    titleCell.value = 'FocusLedger Analytics Report';
    titleCell.font = titleStyle.font as ExcelJS.Font;
    ws.getRow(1).height = 30;

    // Subtitle
    ws.mergeCells('A2:E2');
    const subCell = ws.getCell('A2');
    subCell.value = `${dateRange.start} to ${dateRange.end}`;
    subCell.font = subtitleStyle.font as ExcelJS.Font;

    // ── Section 1: Time Breakdown ──
    let row = 4;
    ws.getCell(`A${row}`).value = 'Time Breakdown';
    ws.getCell(`A${row}`).font = { bold: true, size: 12 } as ExcelJS.Font;
    row++;

    const totalSecs = summaries.reduce((s, d) => s + d.totalSeconds, 0);
    const prodSecs = summaries.reduce((s, d) => s + d.productiveSeconds, 0);
    const wasteSecs = summaries.reduce((s, d) => s + d.wastedSeconds, 0);
    const score = totalSecs > 0 ? Math.round((prodSecs / totalSecs) * 100 * 10) / 10 : 0;

    const breakdownData: [string, string][] = [
      ['Total Tracked Time', fmtHMS(totalSecs)],
      ['Productive Time', fmtHMS(prodSecs)],
      ['Non-Productive Time', fmtHMS(wasteSecs)],
      ['Productivity Score', `${score}%`],
    ];
    for (const [label, value] of breakdownData) {
      const r = ws.getRow(row);
      r.getCell(1).value = label;
      r.getCell(1).font = { ...dataStyle.font, bold: false } as ExcelJS.Font;
      r.getCell(2).value = value;
      r.getCell(2).font = { ...dataStyle.font, bold: true } as ExcelJS.Font;
      r.getCell(1).border = borders.all as Partial<ExcelJS.Borders>;
      r.getCell(2).border = borders.all as Partial<ExcelJS.Borders>;
      row++;
    }

    // ── Section 2: Top 10 Applications ──
    row += 2;
    ws.getCell(`A${row}`).value = 'Top 10 Applications';
    ws.getCell(`A${row}`).font = { bold: true, size: 12 } as ExcelJS.Font;
    row++;

    const appMap = new Map<string, { total: number; cls: Classification }>();
    for (const a of activities) {
      const d = appMap.get(a.app_name) || { total: 0, cls: 'unclassified' as Classification };
      d.total += a.duration_seconds;
      if (a.duration_seconds > 0) d.cls = a.classification;
      appMap.set(a.app_name, d);
    }
    const topApps = Array.from(appMap.entries())
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10);

    // Header
    const appHeaderRow = ws.getRow(row);
    ['App Name', 'Total Time', '% of Total', 'Classification'].forEach((h, i) => {
      const c = appHeaderRow.getCell(i + 1);
      c.value = h;
      if (headerStyle.font) c.font = headerStyle.font as ExcelJS.Font;
      if (headerStyle.fill) c.fill = headerStyle.fill as ExcelJS.Fill;
      c.border = borders.all as Partial<ExcelJS.Borders>;
    });
    row++;

    for (const [appName, d] of topApps) {
      const r = ws.getRow(row);
      const pct = totalSecs > 0 ? Math.round((d.total / totalSecs) * 100 * 10) / 10 : 0;
      r.getCell(1).value = appName;
      r.getCell(2).value = fmtHMS(d.total);
      r.getCell(3).value = pct;
      r.getCell(4).value = d.cls;
      for (let c = 1; c <= 4; c++) {
        r.getCell(c).font = dataStyle.font as ExcelJS.Font;
        r.getCell(c).border = borders.all as Partial<ExcelJS.Borders>;
      }
      const cs = classStyle(d.cls);
      if (cs.font) r.getCell(4).font = cs.font as ExcelJS.Font;
      if (cs.fill) r.getCell(4).fill = cs.fill as ExcelJS.Fill;
      row++;
    }

    // ── Section 3: Hourly Productivity ──
    row += 2;
    ws.getCell(`A${row}`).value = 'Hourly Productivity';
    ws.getCell(`A${row}`).font = { bold: true, size: 12 } as ExcelJS.Font;
    row++;

    const hourHeader = ws.getRow(row);
    ['Hour', 'Productive', 'Non-Productive', 'Total', 'Score'].forEach((h, i) => {
      const c = hourHeader.getCell(i + 1);
      c.value = h;
      if (headerStyle.font) c.font = headerStyle.font as ExcelJS.Font;
      if (headerStyle.fill) c.fill = headerStyle.fill as ExcelJS.Fill;
      c.border = borders.all as Partial<ExcelJS.Borders>;
    });
    row++;

    // Aggregate hourly
    const hourly = new Map<number, { prod: number; waste: number; total: number }>();
    for (const a of activities) {
      const h = new Date(a.started_at).getHours();
      const d = hourly.get(h) || { prod: 0, waste: 0, total: 0 };
      d.total += a.duration_seconds;
      if (a.classification === 'productive') d.prod += a.duration_seconds;
      if (a.classification === 'non-productive') d.waste += a.duration_seconds;
      hourly.set(h, d);
    }

    for (let h = 6; h <= 23; h++) {
      const d = hourly.get(h) || { prod: 0, waste: 0, total: 0 };
      const hScore = d.total > 0 ? Math.round((d.prod / d.total) * 100) : 0;
      const suffix = h >= 12 ? 'PM' : 'AM';
      const display = h === 0 ? 12 : h > 12 ? h - 12 : h;

      const r = ws.getRow(row);
      r.getCell(1).value = `${display}:00 ${suffix}`;
      r.getCell(2).value = fmtDuration(d.prod);
      r.getCell(3).value = fmtDuration(d.waste);
      r.getCell(4).value = fmtDuration(d.total);
      r.getCell(5).value = d.total > 0 ? `${hScore}%` : '—';

      for (let c = 1; c <= 5; c++) {
        r.getCell(c).font = dataStyle.font as ExcelJS.Font;
        r.getCell(c).border = borders.all as Partial<ExcelJS.Borders>;
      }

      // Gradient fill for score
      if (d.total > 0) {
        const scoreCell = r.getCell(5);
        if (hScore >= 70) scoreCell.fill = greenFill as ExcelJS.Fill;
        else if (hScore >= 40) scoreCell.fill = yellowFill as ExcelJS.Fill;
        else scoreCell.fill = redFill as ExcelJS.Fill;
      }
      row++;
    }
  }

  // ── Sheet 4: Weekly Trends ──────────────────────────────────────

  private buildWeeklyTrends(wb: ExcelJS.Workbook, summaries: DaySummary[]): void {
    const ws = wb.addWorksheet('Weekly Trends');

    ws.columns = [
      { header: 'Day', key: 'day', width: 12 },
      { header: 'Date', key: 'date', width: 14 },
      { header: 'Productive Hours', key: 'prodHours', width: 18 },
      { header: 'Non-Productive Hours', key: 'wasteHours', width: 22 },
      { header: 'Score', key: 'score', width: 12 },
    ];

    const headerRow = ws.getRow(1);
    applyStyleToRow(headerRow, headerStyle);
    headerRow.height = 24;

    let bestIdx = 0, worstIdx = 0;
    for (let i = 0; i < summaries.length; i++) {
      if (summaries[i].score > summaries[bestIdx].score) bestIdx = i;
      if (summaries[i].score < summaries[worstIdx].score && summaries[i].totalSeconds > 0) worstIdx = i;
    }

    for (let i = 0; i < summaries.length; i++) {
      const s = summaries[i];
      const d = new Date(s.date + 'T12:00:00');
      const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });

      const row = ws.addRow({
        day: dayName,
        date: s.date,
        prodHours: Math.round((s.productiveSeconds / 3600) * 100) / 100,
        wasteHours: Math.round((s.wastedSeconds / 3600) * 100) / 100,
        score: s.score,
      });

      const style = i % 2 === 0 ? dataStyle : dataStyleAlt;
      applyStyleToRow(row, style);

      // Highlight best/worst
      if (i === bestIdx && s.totalSeconds > 0) {
        row.eachCell((cell) => { cell.fill = greenFill as ExcelJS.Fill; });
      }
      if (i === worstIdx && i !== bestIdx && s.totalSeconds > 0) {
        row.eachCell((cell) => { cell.fill = redFill as ExcelJS.Fill; });
      }

      // Score conditional
      const scoreCell = row.getCell('score');
      if (s.score >= 70) scoreCell.fill = greenFill as ExcelJS.Fill;
      else if (s.score >= 40) scoreCell.fill = yellowFill as ExcelJS.Fill;
      else if (s.totalSeconds > 0) scoreCell.fill = redFill as ExcelJS.Fill;
    }

    // Average row
    const avgScore = summaries.length > 0
      ? Math.round(summaries.reduce((s, d) => s + d.score, 0) / summaries.length * 10) / 10
      : 0;
    const avgProd = summaries.length > 0
      ? Math.round(summaries.reduce((s, d) => s + d.productiveSeconds, 0) / summaries.length / 3600 * 100) / 100
      : 0;
    const avgWaste = summaries.length > 0
      ? Math.round(summaries.reduce((s, d) => s + d.wastedSeconds, 0) / summaries.length / 3600 * 100) / 100
      : 0;

    const avgRow = ws.addRow({
      day: 'AVERAGE',
      date: '',
      prodHours: avgProd,
      wasteHours: avgWaste,
      score: avgScore,
    });
    applyStyleToRow(avgRow, totalStyle);

    ws.views = [{ state: 'frozen', ySplit: 1 }];
  }
}
