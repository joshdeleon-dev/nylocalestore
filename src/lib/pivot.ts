// Small pivot-table engine for the marketplace reports: group rows by up to a few
// dimensions (and optionally one column dimension), then aggregate measures.
// Pure functions, shared by the on-screen table and the CSV export.

export type Agg = 'count' | 'sum' | 'avg' | 'min' | 'max';
export type MeasureFormat = 'money' | 'percent' | 'number';

export interface Dimension<R> { key: string; label: string; get: (r: R) => string }
export interface Measure<R> { key: string; label: string; format: MeasureFormat; get: (r: R) => number | null; countOnly?: boolean }
export interface ValueSpec { measure: string; agg: Agg }
export interface Filter { dim: string; values: string[] }

export interface PivotConfig { rows: string[]; col: string | null; values: ValueSpec[]; filters: Filter[] }

export const AGG_LABELS: Record<Agg, string> = { count: 'Count', sum: 'Sum', avg: 'Average', min: 'Min', max: 'Max' };

export const BLANK = '(blank)';

// "Group 2" before "Group 10"; blanks and "None"/"Not set" after real values
const LAST = new Set([BLANK, 'None', 'Not set']);
export function compareValues(a: string, b: string) {
  const la = LAST.has(a), lb = LAST.has(b);
  if (la !== lb) return la ? 1 : -1;
  return a.localeCompare(b, 'en', { numeric: true, sensitivity: 'base' });
}

function aggregate(values: (number | null)[], agg: Agg): number | null {
  if (agg === 'count') return values.length;
  const nums = values.filter((v): v is number => v != null);
  if (nums.length === 0) return null;
  if (agg === 'sum') return nums.reduce((t, n) => t + n, 0);
  if (agg === 'avg') return nums.reduce((t, n) => t + n, 0) / nums.length;
  if (agg === 'min') return Math.min(...nums);
  return Math.max(...nums);
}

export interface PivotResult {
  rowKeys: string[][];   // one tuple per row (values of each row dimension)
  colKeys: string[];     // column-dimension values; [''] when there is no column dimension
  cell: (rowKey: string[] | null, colKey: string | null, valueIndex: number) => number | null; // null key = total
  rowCount: number;      // source rows after filtering
}

export function computePivot<R>(data: R[], config: PivotConfig, dims: Dimension<R>[], measures: Measure<R>[]): PivotResult {
  const dim = (k: string) => dims.find((d) => d.key === k)!;
  const meas = (k: string) => measures.find((m) => m.key === k)!;
  const read = (r: R, k: string) => dim(k).get(r) || BLANK;

  const rows = data.filter((r) => config.filters.every((f) => f.values.length === 0 || f.values.includes(read(r, f.dim))));
  const rowDims = config.rows.filter((k) => dims.some((d) => d.key === k));
  const colDim = config.col && dims.some((d) => d.key === config.col) ? config.col : null;
  const values = config.values.filter((v) => measures.some((m) => m.key === v.measure));

  // Bucket source rows by "rowKey|colKey"; also by row only, col only, and grand total
  const SEP = '\u0000';
  const buckets = new Map<string, R[]>();
  const add = (k: string, r: R) => { const b = buckets.get(k); if (b) b.push(r); else buckets.set(k, [r]); };
  const rowKeyMap = new Map<string, string[]>();
  const colSet = new Set<string>();

  for (const r of rows) {
    const rk = rowDims.map((k) => read(r, k));
    const rkStr = rk.join(SEP);
    const ck = colDim ? read(r, colDim) : '';
    rowKeyMap.set(rkStr, rk);
    colSet.add(ck);
    add(`R${rkStr}\u0001C${ck}`, r);
    add(`R${rkStr}\u0001*`, r);
    add(`*\u0001C${ck}`, r);
    add('*\u0001*', r);
  }

  const rowKeys = [...rowKeyMap.values()].sort((a, b) => {
    for (let i = 0; i < a.length; i++) {
      const c = compareValues(a[i], b[i]);
      if (c) return c;
    }
    return 0;
  });
  const colKeys = colDim ? [...colSet].sort(compareValues) : [''];

  const cache = new Map<string, number | null>();
  const cell = (rowKey: string[] | null, colKey: string | null, vi: number) => {
    const k = `${rowKey ? `R${rowKey.join(SEP)}` : '*'}\u0001${colKey != null && colDim ? `C${colKey}` : '*'}`;
    const ck = `${k}\u0002${vi}`;
    if (cache.has(ck)) return cache.get(ck)!;
    const bucket = buckets.get(k) ?? [];
    const v = values[vi];
    const m = meas(v.measure);
    const result = bucket.length === 0 ? null : aggregate(bucket.map((r) => m.get(r)), m.countOnly ? 'count' : v.agg);
    cache.set(ck, result);
    return result;
  };

  return { rowKeys, colKeys, cell, rowCount: rows.length };
}

export function formatMeasure(n: number | null, format: MeasureFormat, agg: Agg) {
  if (n == null) return '';
  if (agg === 'count') return n.toLocaleString('en-US');
  if (format === 'money') return (n / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  if (format === 'percent') return `${Math.round(n * 100) / 100}%`;
  return (Math.round(n * 100) / 100).toLocaleString('en-US');
}

// Plain numbers for spreadsheets (dollars, not cents)
export function rawMeasure(n: number | null, format: MeasureFormat, agg: Agg) {
  if (n == null) return '';
  if (agg === 'count') return String(n);
  if (format === 'money') return (n / 100).toFixed(2);
  return String(Math.round(n * 100) / 100);
}

export const valueLabel = <R,>(v: ValueSpec, measures: Measure<R>[]) => {
  const m = measures.find((x) => x.key === v.measure);
  if (!m) return v.measure;
  return m.countOnly ? m.label : `${AGG_LABELS[v.agg]} of ${m.label}`;
};

// CSV of exactly what the pivot shows, with totals
export function pivotToRows<R>(result: PivotResult, config: PivotConfig, dims: Dimension<R>[], measures: Measure<R>[]): string[][] {
  const dimLabel = (k: string) => dims.find((d) => d.key === k)?.label ?? k;
  const values = config.values.filter((v) => measures.some((m) => m.key === v.measure));
  const fmt = (vi: number, n: number | null) => {
    const m = measures.find((x) => x.key === values[vi].measure)!;
    return rawMeasure(n, m.format, m.countOnly ? 'count' : values[vi].agg);
  };
  const hasCol = !!config.col;
  const header = [...config.rows.map(dimLabel)];
  if (hasCol) {
    for (const c of result.colKeys) for (const v of values) header.push(`${dimLabel(config.col!)}: ${c} · ${valueLabel(v, measures)}`);
  }
  for (const v of values) header.push(hasCol ? `Total · ${valueLabel(v, measures)}` : valueLabel(v, measures));

  const line = (rk: string[] | null) => {
    const out = rk ? [...rk] : ['Total', ...config.rows.slice(1).map(() => '')];
    if (hasCol) for (const c of result.colKeys) values.forEach((_, vi) => out.push(fmt(vi, result.cell(rk, c, vi))));
    values.forEach((_, vi) => out.push(fmt(vi, result.cell(rk, null, vi))));
    return out;
  };
  return [header, ...result.rowKeys.map(line), line(null)];
}
