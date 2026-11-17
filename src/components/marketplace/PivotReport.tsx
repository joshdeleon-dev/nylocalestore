'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Filter as FilterIcon, Loader2, Plus, RotateCcw, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { downloadCsv } from '@/lib/csv';
import { DEFAULT_PIVOT, REPORT_DIMENSIONS, REPORT_MEASURES, ReportBasis, ReportItem, detailRows } from '@/lib/marketplaceReport';
import { AGG_LABELS, Agg, BLANK, PivotConfig, compareValues, computePivot, formatMeasure, pivotToRows, valueLabel } from '@/lib/pivot';

const MAX_ROW_FIELDS = 3;
const STORAGE_KEY = 'mp-pivot-config-v1';
const dimLabel = (k: string) => REPORT_DIMENSIONS.find((d) => d.key === k)?.label ?? k;

// Remembered per browser; falls back to the default if storage is unavailable or stale
function loadSaved(): { basis: ReportBasis; config: PivotConfig } | null {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!saved?.config?.rows?.length || !Array.isArray(saved.config.values)) return null;
    return saved;
  } catch {
    return null;
  }
}

export function PivotReport({ range }: { range: { from: string; to: string } }) {
  const [basis, setBasis] = useState<ReportBasis>('sold');
  const [config, setConfig] = useState<PivotConfig>(DEFAULT_PIVOT);
  const [items, setItems] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDraft, setFilterDraft] = useState('');
  const latestRequest = useRef(0);
  // Don't save until the saved setup has been restored, or the default would overwrite it
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    const saved = loadSaved();
    if (saved) { setBasis(saved.basis === 'all' ? 'all' : 'sold'); setConfig(saved.config); }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ basis, config })); } catch {}
  }, [restored, basis, config]);

  useEffect(() => {
    if (range.from && range.to && range.from > range.to) return;
    const requestId = ++latestRequest.current;
    setLoading(true);
    const q = new URLSearchParams({ view: 'items', basis });
    if (range.from) q.set('from', range.from);
    if (range.to) q.set('to', range.to);
    fetch(`/api/admin/marketplace/reports?${q}`)
      .then(async (res) => {
        const json = await res.json();
        if (requestId !== latestRequest.current) return;
        if (res.ok) setItems(json.items);
        else toast.error(json.error || 'Failed to load pivot report');
        setLoading(false);
      })
      .catch(() => { if (requestId === latestRequest.current) { toast.error('Failed to load pivot report'); setLoading(false); } });
  }, [basis, range]);

  const result = useMemo(() => computePivot(items, config, REPORT_DIMENSIONS, REPORT_MEASURES), [items, config]);
  const values = config.values;
  const hasCol = !!config.col;

  const update = (patch: Partial<PivotConfig>) => setConfig((c) => ({ ...c, ...patch }));
  const usedDims = new Set([...config.rows, ...(config.col ? [config.col] : [])]);

  const setRow = (i: number, key: string) => update({ rows: config.rows.map((r, j) => (j === i ? key : r)) });
  const addRow = () => {
    const next = REPORT_DIMENSIONS.find((d) => !usedDims.has(d.key));
    if (next) update({ rows: [...config.rows, next.key] });
  };
  const setValue = (i: number, patch: Partial<{ measure: string; agg: Agg }>) =>
    update({ values: values.map((v, j) => (j === i ? { ...v, ...patch } : v)) });

  // Values available for a filter field, from the loaded data
  const filterOptions = (dim: string) => {
    const d = REPORT_DIMENSIONS.find((x) => x.key === dim)!;
    return [...new Set(items.map((r) => d.get(r) || BLANK))].sort(compareValues);
  };
  const toggleFilterValue = (dim: string, value: string) =>
    update({
      filters: config.filters.map((f) => (f.dim !== dim ? f : {
        ...f, values: f.values.includes(value) ? f.values.filter((v) => v !== value) : [...f.values, value],
      })),
    });

  const fmt = (vi: number, n: number | null) => {
    const m = REPORT_MEASURES.find((x) => x.key === values[vi].measure)!;
    return formatMeasure(n, m.format, m.countOnly ? 'count' : values[vi].agg);
  };

  const stamp = `${range.from || 'all'}_${range.to || 'time'}`;
  const exportDetails = () => {
    if (!items.length) { toast.error('Nothing to export'); return; }
    // Details respect the pivot filters, so a filtered view exports just those items
    const kept = items.filter((r) => config.filters.every((f) => {
      const d = REPORT_DIMENSIONS.find((x) => x.key === f.dim)!;
      return f.values.length === 0 || f.values.includes(d.get(r) || BLANK);
    }));
    downloadCsv(`marketplace-details_${basis}_${stamp}.csv`, detailRows(kept));
  };
  const exportPivot = () => {
    if (!result.rowCount) { toast.error('Nothing to export'); return; }
    downloadCsv(`marketplace-pivot_${basis}_${stamp}.csv`, pivotToRows(result, config, REPORT_DIMENSIONS, REPORT_MEASURES));
  };

  return (
    <section className="card p-4 sm:p-5 space-y-4" aria-labelledby="pivot-heading">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <h2 id="pivot-heading" className="font-serif text-xl text-coffee-900">Pivot report</h2>
          <p className="text-sm text-coffee-500">Group by any seller, buyer or item field. Uses the date range above.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportDetails} disabled={loading} className="btn btn-secondary gap-2"><Download className="w-4 h-4" /> Details CSV</button>
          <button onClick={exportPivot} disabled={loading} className="btn btn-secondary gap-2"><Download className="w-4 h-4" /> Pivot CSV</button>
        </div>
      </div>

      <div className="inline-flex rounded-full border border-coffee-200 p-0.5 text-sm" role="radiogroup" aria-label="Which items">
        {([['sold', 'Sold items · by sale date'], ['all', 'All items · by submitted date']] as const).map(([k, label]) => (
          <button
            key={k}
            role="radio"
            aria-checked={basis === k}
            onClick={() => setBasis(k)}
            className={`px-3.5 py-1.5 rounded-full transition-colors ${basis === k ? 'bg-coffee-900 text-white' : 'text-coffee-700 hover:bg-coffee-50'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Rows */}
        <fieldset className="space-y-2">
          <legend className="label">Rows</legend>
          {config.rows.map((key, i) => (
            <div key={i} className="flex gap-2">
              <select className="select py-1.5" value={key} onChange={(e) => setRow(i, e.target.value)} aria-label={`Row field ${i + 1}`}>
                {REPORT_DIMENSIONS.filter((d) => d.key === key || !usedDims.has(d.key)).map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
              {config.rows.length > 1 && (
                <button onClick={() => update({ rows: config.rows.filter((_, j) => j !== i) })} className="p-2 text-coffee-400 hover:text-coffee-800" aria-label={`Remove ${dimLabel(key)}`}><X className="w-4 h-4" /></button>
              )}
            </div>
          ))}
          {config.rows.length < MAX_ROW_FIELDS && (
            <button onClick={addRow} className="inline-flex items-center gap-1 text-sm text-coffee-600 hover:text-coffee-900"><Plus className="w-4 h-4" /> Add row field</button>
          )}
        </fieldset>

        {/* Columns */}
        <fieldset className="space-y-2">
          <legend className="label">Columns</legend>
          <select className="select py-1.5" value={config.col ?? ''} onChange={(e) => update({ col: e.target.value || null })} aria-label="Column field">
            <option value="">None</option>
            {REPORT_DIMENSIONS.filter((d) => d.key === config.col || !usedDims.has(d.key)).map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
        </fieldset>

        {/* Values */}
        <fieldset className="space-y-2">
          <legend className="label">Values</legend>
          {values.map((v, i) => {
            const m = REPORT_MEASURES.find((x) => x.key === v.measure);
            return (
              <div key={i} className="flex gap-2">
                <select className="select py-1.5" value={v.measure} onChange={(e) => setValue(i, { measure: e.target.value, agg: REPORT_MEASURES.find((x) => x.key === e.target.value)?.countOnly ? 'count' : v.agg === 'count' ? 'sum' : v.agg })} aria-label={`Value ${i + 1}`}>
                  {REPORT_MEASURES.map((x) => <option key={x.key} value={x.key}>{x.label}</option>)}
                </select>
                {!m?.countOnly && (
                  <select className="select py-1.5 w-32" value={v.agg} onChange={(e) => setValue(i, { agg: e.target.value as Agg })} aria-label={`How to total ${m?.label}`}>
                    {(['sum', 'avg', 'min', 'max', 'count'] as Agg[]).map((a) => <option key={a} value={a}>{AGG_LABELS[a]}</option>)}
                  </select>
                )}
                {values.length > 1 && (
                  <button onClick={() => update({ values: values.filter((_, j) => j !== i) })} className="p-2 text-coffee-400 hover:text-coffee-800" aria-label={`Remove ${m?.label}`}><X className="w-4 h-4" /></button>
                )}
              </div>
            );
          })}
          <button onClick={() => update({ values: [...values, { measure: 'sale_price', agg: 'sum' }] })} className="inline-flex items-center gap-1 text-sm text-coffee-600 hover:text-coffee-900"><Plus className="w-4 h-4" /> Add value</button>
        </fieldset>
      </div>

      {/* Filters */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="label mb-0 inline-flex items-center gap-1"><FilterIcon className="w-3.5 h-3.5" /> Filters</span>
          <select
            className="select py-1.5 w-auto"
            value={filterDraft}
            onChange={(e) => {
              const dim = e.target.value;
              setFilterDraft('');
              if (dim && !config.filters.some((f) => f.dim === dim)) update({ filters: [...config.filters, { dim, values: [] }] });
            }}
            aria-label="Add a filter"
          >
            <option value="">Add filter…</option>
            {REPORT_DIMENSIONS.filter((d) => !config.filters.some((f) => f.dim === d.key)).map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
          </select>
          <button onClick={() => { setConfig(DEFAULT_PIVOT); setBasis('sold'); }} className="ml-auto inline-flex items-center gap-1 text-sm text-coffee-500 hover:text-coffee-900"><RotateCcw className="w-3.5 h-3.5" /> Reset</button>
        </div>
        {config.filters.map((f) => (
          <div key={f.dim} className="rounded-xl border border-coffee-100 bg-coffee-50/50 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-coffee-900">{dimLabel(f.dim)} <span className="text-coffee-400 font-normal">{f.values.length ? `· ${f.values.length} selected` : '· all'}</span></p>
              <button onClick={() => update({ filters: config.filters.filter((x) => x.dim !== f.dim) })} className="p-1 text-coffee-400 hover:text-coffee-800" aria-label={`Remove ${dimLabel(f.dim)} filter`}><X className="w-4 h-4" /></button>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {filterOptions(f.dim).map((v) => (
                <button
                  key={v}
                  onClick={() => toggleFilterValue(f.dim, v)}
                  aria-pressed={f.values.includes(v)}
                  className={`px-2.5 py-1 rounded-full text-xs border ${f.values.includes(v) ? 'bg-coffee-900 text-white border-coffee-900' : 'bg-white text-coffee-700 border-coffee-200 hover:bg-coffee-50'}`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="p-10 text-center text-sm text-coffee-400"><Loader2 className="w-5 h-5 animate-spin inline" /></div>
      ) : result.rowCount === 0 ? (
        <div className="p-10 text-center text-sm text-coffee-400">No items match.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-coffee-100">
          <table className="w-full text-sm" aria-label="Pivot report">
            <thead className="bg-coffee-50 text-left text-xs uppercase tracking-wider text-coffee-500">
              {hasCol && (
                <tr>
                  <th colSpan={config.rows.length} className="px-3 py-2 font-medium normal-case tracking-normal text-coffee-700">{dimLabel(config.col!)}</th>
                  {result.colKeys.map((c) => <th key={c} colSpan={values.length} className="px-3 py-2 text-center border-l border-coffee-100 normal-case tracking-normal text-coffee-800">{c}</th>)}
                  <th colSpan={values.length} className="px-3 py-2 text-center border-l border-coffee-200 normal-case tracking-normal text-coffee-900">Total</th>
                </tr>
              )}
              <tr>
                {config.rows.map((k) => <th key={k} className="px-3 py-2 font-medium whitespace-nowrap">{dimLabel(k)}</th>)}
                {(hasCol ? [...result.colKeys, null] : [null]).flatMap((c, ci) =>
                  values.map((v, vi) => (
                    <th key={`${ci}-${vi}`} className={`px-3 py-2 font-medium text-right whitespace-nowrap ${vi === 0 && hasCol ? 'border-l border-coffee-100' : ''}`}>{valueLabel(v, REPORT_MEASURES)}</th>
                  )),
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-coffee-100">
              {result.rowKeys.map((rk) => (
                <tr key={rk.join('|')} className="hover:bg-coffee-50/50">
                  {rk.map((v, i) => <td key={i} className="px-3 py-2 text-gray-900 whitespace-nowrap">{v}</td>)}
                  {(hasCol ? [...result.colKeys, null] : [null]).flatMap((c, ci) =>
                    values.map((_, vi) => (
                      <td key={`${ci}-${vi}`} className={`px-3 py-2 text-right tabular-nums ${c === null ? 'font-semibold' : ''} ${vi === 0 && hasCol ? 'border-l border-coffee-100' : ''}`}>{fmt(vi, result.cell(rk, c, vi))}</td>
                    )),
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-coffee-50 font-semibold text-gray-900">
              <tr>
                <td className="px-3 py-2" colSpan={config.rows.length}>Total · {result.rowCount} item{result.rowCount === 1 ? '' : 's'}</td>
                {(hasCol ? [...result.colKeys, null] : [null]).flatMap((c, ci) =>
                  values.map((_, vi) => (
                    <td key={`${ci}-${vi}`} className={`px-3 py-2 text-right tabular-nums ${vi === 0 && hasCol ? 'border-l border-coffee-100' : ''}`}>{fmt(vi, result.cell(null, c, vi))}</td>
                  )),
                )}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}
