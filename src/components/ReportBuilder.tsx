'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';
import {
  Play, Download, FileSpreadsheet, ChevronDown, ChevronRight,
  AlertCircle, Loader2, Save, BookOpen, Trash2, X,
  ChevronUp, ChevronsUpDown, Grid3x3, Printer,
} from 'lucide-react';
import { SavedReport } from '@/types';
import toast from 'react-hot-toast';
import { formatCurrency } from '@/utils/helpers';

interface FieldDef { key: string; label: string; }
interface FieldGroup { group: string; fields: FieldDef[]; }

const ORDER_FIELD_GROUPS: FieldGroup[] = [
  {
    group: 'Customer',
    fields: [
      { key: 'customer_name', label: 'Customer Name' },
      { key: 'customer_phone', label: 'Customer Phone' },
      { key: 'group_number', label: 'Group Number' },
      { key: 'notes', label: 'Order Notes' },
    ],
  },
  {
    group: 'Orders',
    fields: [
      { key: 'order_number', label: 'Order Number' },
      { key: 'status', label: 'Order Status' },
      { key: 'order_date', label: 'Order Date' },
      { key: 'sales_date', label: 'Sales Date' },
      { key: 'created_at', label: 'Created Date' },
      { key: 'updated_at', label: 'Updated Date' },
      { key: 'completed_date', label: 'Completed Date' },
      { key: 'cancelled_date', label: 'Cancelled Date' },
      { key: 'payment_method', label: 'Payment Method' },
      { key: 'payment_status', label: 'Payment Status' },
      { key: 'subtotal', label: 'Subtotal' },
      { key: 'tax', label: 'Tax' },
      { key: 'total', label: 'Total' },
    ],
  },
  {
    group: 'Order Items',
    fields: [
      { key: 'product_name', label: 'Product Name' },
      { key: 'category', label: 'Category' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'unit_price', label: 'Unit Price' },
      { key: 'line_total', label: 'Line Total' },
      { key: 'modifiers', label: 'Modifiers' },
    ],
  },
];

const INVENTORY_FIELD_GROUPS: FieldGroup[] = [
  {
    group: 'Inventory',
    fields: [
      { key: 'product_name', label: 'Product Name' },
      { key: 'current_stock', label: 'Current Stock' },
      { key: 'quantity_change', label: 'Inventory Changes' },
      { key: 'adjustment_reason', label: 'Adjustment Reason' },
    ],
  },
];

const ORDER_DEFAULTS = new Set(['order_number', 'customer_name', 'group_number', 'order_date', 'sales_date', 'status', 'total', 'product_name', 'quantity', 'unit_price', 'line_total']);
const INVENTORY_DEFAULTS = new Set(['product_name', 'current_stock']);
const ORDER_STATUSES = ['NEW', 'ACCEPTED', 'IN_PROGRESS', 'READY', 'COMPLETED', 'CANCELLED'];

const FIELD_LABELS: Record<string, string> = {
  customer_name: 'Customer Name', customer_phone: 'Customer Phone',
  group_number: 'Group #', notes: 'Notes',
  order_number: 'Order #', status: 'Status', order_date: 'Order Date',
  sales_date: 'Sales Date', created_at: 'Created', updated_at: 'Updated',
  completed_date: 'Completed', cancelled_date: 'Cancelled',
  payment_method: 'Payment Method', payment_status: 'Payment Status',
  subtotal: 'Subtotal', tax: 'Tax', total: 'Total',
  product_name: 'Product', category: 'Category', quantity: 'Qty',
  unit_price: 'Unit Price', line_total: 'Line Total', modifiers: 'Modifiers',
  current_stock: 'Current Stock', quantity_change: 'Change', adjustment_reason: 'Reason',
};

function exportCSV(rows: Record<string, any>[], fields: string[], filename: string) {
  if (!rows.length) return;
  const headers = fields.map((f) => FIELD_LABELS[f] ?? f);
  const csv = [
    headers.join(','),
    ...rows.map((row) =>
      fields.map((f) => `"${String(row[f] ?? '').replace(/"/g, '""')}"`).join(',')
    ),
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function exportXLSX(rows: Record<string, any>[], fields: string[], filename: string) {
  if (!rows.length) return;
  const sheetData = [
    fields.map((f) => FIELD_LABELS[f] ?? f),
    ...rows.map((row) => fields.map((f) => row[f] ?? '')),
  ];
  const ws = XLSX.utils.aoa_to_sheet(sheetData);
  const range = XLSX.utils.decode_range(ws['!ref'] ?? 'A1');
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = { font: { bold: true } };
  }
  ws['!cols'] = fields.map((f) => ({ wch: Math.max((FIELD_LABELS[f] ?? f).length + 2, 14) }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Report');
  XLSX.writeFile(wb, filename);
}

export default function ReportBuilder() {
  const [source, setSource] = useState<'orders' | 'inventory'>('orders');
  const [selectedFields, setSelectedFields] = useState<Set<string>>(new Set(ORDER_DEFAULTS));
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({ start_date: '', end_date: '', status: '' });
  const [rows, setRows] = useState<Record<string, any>[]>([]);
  const [orderedFields, setOrderedFields] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasRun, setHasRun] = useState(false);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Save / Load reports
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showLoadPanel, setShowLoadPanel] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saving, setSaving] = useState(false);

  const [pivotMode, setPivotMode] = useState(false);
  const [pivotRows, setPivotRows] = useState<string[]>([]);
  const [pivotCol, setPivotCol] = useState('');
  const [pivotValues, setPivotValues] = useState<string[]>([]);
  const [pivotAgg, setPivotAgg] = useState<'count' | 'sum' | 'avg' | 'min' | 'max'>('sum');
  const [pivotFilters, setPivotFilters] = useState<{ id: number; field: string; op: string; value: string }[]>([]);
  const [pivotSubtotalFields, setPivotSubtotalFields] = useState<string[]>([]);

  const fieldGroups = source === 'orders' ? ORDER_FIELD_GROUPS : INVENTORY_FIELD_GROUPS;

  const requestSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const displayRows = useMemo(() => {
    if (!sortKey) return rows;
    return [...rows].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      const cmp =
        typeof av === 'string'
          ? av.toLowerCase().localeCompare(bv.toLowerCase())
          : Number(av) < Number(bv) ? -1 : Number(av) > Number(bv) ? 1 : 0;
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, sortKey, sortDir]);

  const KNOWN_NUMERIC = new Set(['quantity', 'unit_price', 'line_total', 'subtotal', 'tax', 'total', 'current_stock', 'quantity_change', 'group_number']);

  const numericFields = useMemo(
    () => orderedFields.filter((f) =>
      KNOWN_NUMERIC.has(f) || (rows.length > 0 && rows.slice(0, 5).some((r) => r[f] != null && r[f] !== '' && !isNaN(Number(r[f]))))
    ),
    [rows, orderedFields]
  );

  const pivotResult = useMemo(() => {
    if (!pivotRows.length || !rows.length) return null;
    if (pivotAgg !== 'count' && !pivotValues.length) return null;

    const colField = pivotCol || null;
    const effectiveVFs = pivotAgg === 'count' ? ['__count__'] : pivotValues;

    // Strip "$" and "," so currency strings like "$3.50" become 3.5
    const parseNum = (v: any): number => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string') return parseFloat(v.replace(/[$,]/g, '')) || 0;
      return 0;
    };

    const activeFilters = pivotFilters.filter((pf) => pf.field && pf.value !== '');
    const filteredRows = activeFilters.length === 0 ? rows : rows.filter((row) =>
      activeFilters.every(({ field, op, value }) => {
        const rv = String(row[field] ?? '').toLowerCase();
        const fv = value.toLowerCase();
        const rn = parseNum(row[field]);
        const fn = parseFloat(value) || 0;
        const parts = fv.split(',').map((v) => v.trim()).filter(Boolean);
        switch (op) {
          case '=':        return parts.some((p) => rv === p);
          case '!=':       return parts.every((p) => rv !== p);
          case 'contains': return parts.some((p) => rv.includes(p));
          case 'starts':   return parts.some((p) => rv.startsWith(p));
          case '>':        return rn > fn;
          case '<':        return rn < fn;
          case '>=':       return rn >= fn;
          case '<=':       return rn <= fn;
          default:         return true;
        }
      })
    );

    const SEP = '\x00';
    type ColData = Record<string, Record<string, number[]>>;
    const entryMap = new Map<string, { fieldValues: string[]; colData: ColData }>();

    for (const row of filteredRows) {
      const fieldValues = pivotRows.map((f) => String(row[f] ?? '(blank)'));
      const compositeKey = fieldValues.join(SEP);
      const cv = colField ? String(row[colField] ?? '(blank)') : '_';
      if (!entryMap.has(compositeKey)) entryMap.set(compositeKey, { fieldValues, colData: {} });
      const entry = entryMap.get(compositeKey)!;
      if (!entry.colData[cv]) entry.colData[cv] = {};
      for (const vf of effectiveVFs) {
        if (!entry.colData[cv][vf]) entry.colData[cv][vf] = [];
        entry.colData[cv][vf].push(pivotAgg === 'count' ? 1 : parseNum(row[vf]));
      }
    }

    const agg = (vals: number[]): number => {
      if (!vals.length) return 0;
      switch (pivotAgg) {
        case 'count': return vals.length;
        case 'sum':   return vals.reduce((a, b) => a + b, 0);
        case 'avg':   return vals.reduce((a, b) => a + b, 0) / vals.length;
        case 'min':   return Math.min(...vals);
        case 'max':   return Math.max(...vals);
      }
    };

    const nat = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true });
    const sortedEntries = [...entryMap.values()].sort((a, b) => {
      for (let i = 0; i < a.fieldValues.length; i++) {
        const cmp = nat(a.fieldValues[i] ?? '', b.fieldValues[i] ?? '');
        if (cmp !== 0) return cmp;
      }
      return 0;
    });

    const colValues = colField
      ? [...new Set(rows.map((r) => String(r[colField] ?? '(blank)')))].sort(nat)
      : ['_'];

    type ColDef = { key: string; label: string; colValue: string; vf: string };
    const colDefs: ColDef[] = colValues.flatMap((cv) =>
      effectiveVFs.map((vf) => {
        const vfLabel = vf === '__count__' ? 'Count' : (FIELD_LABELS[vf] ?? vf);
        const label = colField
          ? effectiveVFs.length > 1 ? `${cv} · ${vfLabel}` : cv
          : vfLabel;
        return { key: `${cv}__${vf}`, label, colValue: cv, vf };
      })
    );

    const hierarchicalRows = sortedEntries.map(({ fieldValues, colData }) => {
      const cells: Record<string, number> = {};
      for (const cd of colDefs) cells[cd.key] = agg(colData[cd.colValue]?.[cd.vf] ?? []);
      const rowTotals: Record<string, number> = {};
      for (const vf of effectiveVFs) rowTotals[vf] = agg(colValues.flatMap((cv) => colData[cv]?.[vf] ?? []));
      return { fieldValues, cells, rowTotals };
    });

    const colTotals: Record<string, number> = {};
    for (const cd of colDefs) colTotals[cd.key] = agg(sortedEntries.flatMap(({ colData }) => colData[cd.colValue]?.[cd.vf] ?? []));

    const showRowTotals = colField !== null && colValues.length > 1;
    const rowTotalDefs = showRowTotals
      ? effectiveVFs.map((vf) => ({
          vf,
          label: effectiveVFs.length > 1
            ? `Total ${vf === '__count__' ? 'Count' : (FIELD_LABELS[vf] ?? vf)}`
            : 'Total',
        }))
      : [];

    const grandTotals: Record<string, number> = {};
    for (const vf of effectiveVFs) grandTotals[vf] = agg(sortedEntries.flatMap(({ colData }) => colValues.flatMap((cv) => colData[cv]?.[vf] ?? [])));

    const rowLabel = pivotRows.map((f) => FIELD_LABELS[f] ?? f).join(' · ');

    // Subtotals
    const subtotalLevelIndices = pivotSubtotalFields
      .map((sf) => pivotRows.indexOf(sf))
      .filter((idx) => idx >= 0 && idx < pivotRows.length - 1);

    type SubtotalEntry = { cells: Record<string, number>; rowTotals: Record<string, number> };
    const subtotalMap = new Map<string, SubtotalEntry>();

    if (subtotalLevelIndices.length > 0) {
      const levelAccums = new Map<number, Map<string, ColData>>();
      for (const li of subtotalLevelIndices) levelAccums.set(li, new Map());

      for (const { fieldValues, colData } of entryMap.values()) {
        for (const li of subtotalLevelIndices) {
          const prefixKey = fieldValues.slice(0, li + 1).join(SEP);
          const accum = levelAccums.get(li)!;
          if (!accum.has(prefixKey)) accum.set(prefixKey, {});
          const target = accum.get(prefixKey)!;
          for (const [cv, vfMap] of Object.entries(colData)) {
            if (!target[cv]) target[cv] = {};
            for (const [vf, vals] of Object.entries(vfMap)) {
              if (!target[cv][vf]) target[cv][vf] = [];
              target[cv][vf].push(...vals);
            }
          }
        }
      }

      for (const [li, accum] of levelAccums) {
        for (const [prefixKey, colData] of accum) {
          const subCells: Record<string, number> = {};
          for (const cd of colDefs) subCells[cd.key] = agg(colData[cd.colValue]?.[cd.vf] ?? []);
          const subRowTotals: Record<string, number> = {};
          for (const vf of effectiveVFs) subRowTotals[vf] = agg(colValues.flatMap((cv) => colData[cv]?.[vf] ?? []));
          subtotalMap.set(`${li}\x00${prefixKey}`, { cells: subCells, rowTotals: subRowTotals });
        }
      }
    }

    return { hierarchicalRows, rowFields: pivotRows, colDefs, colTotals, grandTotals, rowTotalDefs, showRowTotals, effectiveVFs, rowLabel, subtotalMap };
  }, [pivotRows, pivotCol, pivotValues, pivotAgg, pivotFilters, pivotSubtotalFields, rows]);

  const loadSavedReports = async () => {
    try {
      const res = await fetch('/api/saved-reports');
      const data = await res.json();
      setSavedReports(data.reports || []);
    } catch { /* saved_reports table may not exist yet */ }
  };

  useEffect(() => { loadSavedReports(); }, []);

  const switchSource = (s: 'orders' | 'inventory') => {
    setSource(s);
    setSelectedFields(new Set(s === 'orders' ? ORDER_DEFAULTS : INVENTORY_DEFAULTS));
    setRows([]); setHasRun(false); setError('');
  };

  const toggleField = (key: string) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleGroup = (group: string, checked: boolean) => {
    const groupFields = fieldGroups.find((g) => g.group === group)?.fields.map((f) => f.key) ?? [];
    setSelectedFields((prev) => {
      const next = new Set(prev);
      groupFields.forEach((k) => (checked ? next.add(k) : next.delete(k)));
      return next;
    });
  };

  const toggleCollapse = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(group) ? next.delete(group) : next.add(group);
      return next;
    });
  };

  const runReport = useCallback(async () => {
    if (!selectedFields.size) { setError('Select at least one field.'); return; }
    setLoading(true); setError('');
    try {
      const ordered = fieldGroups.flatMap((g) => g.fields.map((f) => f.key)).filter((k) => selectedFields.has(k));
      const res = await fetch('/api/reports/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, fields: ordered, filters }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Unknown error');
      setRows(data.rows ?? []);
      setOrderedFields(ordered);
      setSortKey(null);
      setSortDir('asc');
      setHasRun(true);
    } catch (e: any) {
      setError(e.message ?? 'Failed to run report');
    } finally {
      setLoading(false);
    }
  }, [source, selectedFields, filters, fieldGroups]);

  const handleSaveReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saveName.trim()) return;
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/saved-reports', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          name: saveName.trim(),
          source,
          fields: fieldGroups.flatMap((g) => g.fields.map((f) => f.key)).filter((k) => selectedFields.has(k)),
          filters,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      toast.success('Report saved');
      setShowSaveModal(false);
      setSaveName('');
      loadSavedReports();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  const loadReport = (report: SavedReport) => {
    setSource(report.source);
    setSelectedFields(new Set(report.fields));
    setFilters({ start_date: (report.filters as any).start_date || '', end_date: (report.filters as any).end_date || '', status: (report.filters as any).status || '' });
    setRows([]); setHasRun(false);
    setShowLoadPanel(false);
    toast.success(`Loaded: ${report.name}`);
  };

  const deleteReport = async (id: number) => {
    if (!confirm('Delete this saved report?')) return;
    await fetch(`/api/saved-reports?id=${id}`, { method: 'DELETE' });
    toast.success('Report deleted');
    loadSavedReports();
  };

  const filename = `ny-locale-${source}-report-${new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())}`;

  const MONEY_FIELDS = new Set(['total', 'subtotal', 'tax', 'unit_price', 'line_total']);

  const formatPivotVal = (v: number, vf: string): string => {
    if (vf === '__count__') return Math.round(v).toLocaleString();
    if (MONEY_FIELDS.has(vf)) return formatCurrency(v);
    if (pivotAgg === 'avg') return v.toFixed(2);
    return Number.isInteger(v) ? v.toLocaleString() : v.toFixed(2);
  };

  const printPivot = () => {
    const el = document.getElementById('pivot-table-inner');
    if (!el || !pivotResult) return;
    const win = window.open('', '_blank', 'width=960,height=720');
    if (!win) { toast.error('Popup blocked — allow popups to print'); return; }
    const aggLabel = pivotAgg.charAt(0).toUpperCase() + pivotAgg.slice(1);
    const valueLabel = pivotAgg === 'count' ? 'Count' : pivotValues.map((vf) => FIELD_LABELS[vf] ?? vf).join(', ');
    const rowLabel = pivotResult.rowLabel;
    win.document.write(`<!DOCTYPE html><html><head><title>Pivot Table</title><style>
body{font-family:Arial,sans-serif;padding:24px;font-size:12px;color:#222}
h2{font-size:15px;margin:0 0 4px;color:#4a3728}
p.sub{font-size:11px;color:#888;margin:0 0 14px}
table{border-collapse:collapse;width:100%}
th{background:#4a3728;color:#fff;padding:6px 10px;text-align:left;font-size:11px;white-space:nowrap}
th.num{text-align:right}
td{border:1px solid #e0e0e0;padding:5px 10px;vertical-align:top}
td.num{text-align:right;font-variant-numeric:tabular-nums}
tr:nth-child(even) td{background:#faf8f7}
tfoot td{background:#ede7e2!important;font-weight:700}
.total-col{border-left:2px solid #b39f92;font-weight:700}
@media print{body{padding:0}}
</style></head><body>
<h2>${rowLabel} — ${aggLabel} of ${valueLabel}</h2>
<p class="sub">Generated ${new Intl.DateTimeFormat('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'America/New_York'}).format(new Date())}</p>
${el.outerHTML}
<script>window.onload=function(){window.print();window.onafterprint=function(){window.close();};};<\/script>
</body></html>`);
    win.document.close();
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Source Toggle + Load/Save */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <span className="text-sm font-medium text-gray-600">Source:</span>
        {(['orders', 'inventory'] as const).map((s) => (
          <button
            key={s}
            onClick={() => switchSource(s)}
            className={`px-4 py-1.5 rounded-full text-sm font-semibold capitalize transition-all ${
              source === s ? 'bg-coffee-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setShowLoadPanel(!showLoadPanel)}
            className="btn btn-secondary btn-sm gap-1.5"
          >
            <BookOpen className="w-4 h-4" />
            Saved ({savedReports.length})
          </button>
          <button
            onClick={() => { setSaveName(''); setShowSaveModal(true); }}
            disabled={!selectedFields.size}
            className="btn btn-secondary btn-sm gap-1.5"
          >
            <Save className="w-4 h-4" />
            Save
          </button>
        </div>
      </div>

      {/* Saved Reports Panel */}
      {showLoadPanel && (
        <div className="bg-white rounded-lg border border-gray-200 mb-4 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700">Saved Reports</p>
            <button onClick={() => setShowLoadPanel(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          {savedReports.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-400">No saved reports yet. Configure a report and click Save.</div>
          ) : (
            <div className="divide-y divide-gray-50">
              {savedReports.map((r) => (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{r.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{r.source} · {r.fields.length} fields · {new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(r.created_at))}</p>
                  </div>
                  <button onClick={() => loadReport(r)} className="btn btn-secondary btn-sm">Load</button>
                  <button onClick={() => deleteReport(r.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex gap-4 flex-1 min-h-0">
        {/* ── Left: Field Selector ─────────────────────── */}
        <aside className="w-52 flex-shrink-0 bg-white rounded-lg border border-gray-200 flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Fields</p>
            <button
              className="text-xs text-coffee-700 hover:underline"
              onClick={() => setSelectedFields(new Set(fieldGroups.flatMap((g) => g.fields.map((f) => f.key))))}
            >
              All
            </button>
          </div>
          <div className="overflow-y-auto flex-1 py-2">
            {fieldGroups.map((group) => {
              const groupKeys = group.fields.map((f) => f.key);
              const allChecked = groupKeys.every((k) => selectedFields.has(k));
              const someChecked = groupKeys.some((k) => selectedFields.has(k));
              const collapsed = collapsedGroups.has(group.group);
              return (
                <div key={group.group} className="mb-1">
                  <div className="flex items-center gap-1.5 px-3 py-1.5">
                    <button onClick={() => toggleCollapse(group.group)} className="text-gray-400 hover:text-gray-600">
                      {collapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    </button>
                    <label className="flex items-center gap-2 cursor-pointer select-none flex-1">
                      <input
                        type="checkbox"
                        checked={allChecked}
                        ref={(el) => { if (el) el.indeterminate = !allChecked && someChecked; }}
                        onChange={(e) => toggleGroup(group.group, e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">{group.group}</span>
                    </label>
                  </div>
                  {!collapsed && group.fields.map((field) => (
                    <label key={field.key} className="flex items-center gap-2 px-6 py-1 cursor-pointer hover:bg-gray-50 select-none">
                      <input type="checkbox" checked={selectedFields.has(field.key)} onChange={() => toggleField(field.key)} className="rounded" />
                      <span className="text-sm text-gray-700">{field.label}</span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </aside>

        {/* ── Right: Filters + Results ─────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 gap-3">
          {/* Filters Row */}
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex flex-wrap items-end gap-3">
            <div>
              <label className="label text-xs">From</label>
              <input type="date" value={filters.start_date} onChange={(e) => setFilters((f) => ({ ...f, start_date: e.target.value }))} className="input py-1.5 text-sm" />
            </div>
            <div>
              <label className="label text-xs">To</label>
              <input type="date" value={filters.end_date} onChange={(e) => setFilters((f) => ({ ...f, end_date: e.target.value }))} className="input py-1.5 text-sm" />
            </div>
            {source === 'orders' && (
              <div>
                <label className="label text-xs">Status</label>
                <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="select py-1.5 text-sm">
                  <option value="">All Statuses</option>
                  {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            )}
            <div className="flex items-end gap-2 ml-auto">
              <button onClick={runReport} disabled={loading || !selectedFields.size} className="btn btn-primary gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {loading ? 'Running…' : 'Run Report'}
              </button>
              {hasRun && rows.length > 0 && (
                <>
                  <button onClick={() => exportCSV(rows, orderedFields, filename + '.csv')} className="btn btn-secondary gap-1.5" title="Export CSV">
                    <Download className="w-4 h-4" /> CSV
                  </button>
                  <button onClick={() => exportXLSX(rows, orderedFields, filename + '.xlsx')} className="btn btn-secondary gap-1.5" title="Export Excel">
                    <FileSpreadsheet className="w-4 h-4" /> XLSX
                  </button>
                  <button
                    onClick={() => setPivotMode((m) => !m)}
                    className={`btn gap-1.5 ${pivotMode ? 'bg-coffee-700 text-white border-coffee-700 hover:bg-coffee-800' : 'btn-secondary'}`}
                    title="Pivot Table"
                  >
                    <Grid3x3 className="w-4 h-4" /> Pivot
                  </button>
                </>
              )}
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}

          {pivotMode && hasRun && rows.length > 0 && (
            <div className="bg-coffee-50 border border-coffee-200 rounded-lg p-3 flex flex-wrap gap-4 items-start">
              {/* Rows */}
              <div>
                <label className="label text-xs mb-1">Rows</label>
                <div className="bg-white border border-gray-200 rounded-md max-h-32 overflow-y-auto py-1 w-40">
                  {orderedFields.map((f) => (
                    <label key={f} className="flex items-center gap-2 px-2.5 py-1 cursor-pointer hover:bg-gray-50 select-none">
                      <input
                        type="checkbox"
                        checked={pivotRows.includes(f)}
                        onChange={() => setPivotRows((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f])}
                        className="rounded flex-shrink-0"
                      />
                      <span className="text-xs text-gray-700 truncate">{FIELD_LABELS[f] ?? f}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Columns */}
              <div>
                <label className="label text-xs mb-1">Columns (optional)</label>
                <select value={pivotCol} onChange={(e) => setPivotCol(e.target.value)} className="select py-1.5 text-sm block w-40">
                  <option value="">None</option>
                  {orderedFields.filter((f) => !pivotRows.includes(f)).map((f) => (
                    <option key={f} value={f}>{FIELD_LABELS[f] ?? f}</option>
                  ))}
                </select>
              </div>

              {/* Values */}
              {pivotAgg !== 'count' && (
                <div>
                  <label className="label text-xs mb-1">Values</label>
                  <div className="bg-white border border-gray-200 rounded-md max-h-32 overflow-y-auto py-1 w-40">
                    {(numericFields.length > 0 ? numericFields : orderedFields).map((f) => (
                      <label key={f} className="flex items-center gap-2 px-2.5 py-1 cursor-pointer hover:bg-gray-50 select-none">
                        <input
                          type="checkbox"
                          checked={pivotValues.includes(f)}
                          onChange={() => setPivotValues((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f])}
                          className="rounded flex-shrink-0"
                        />
                        <span className="text-xs text-gray-700 truncate">{FIELD_LABELS[f] ?? f}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Aggregation */}
              <div>
                <label className="label text-xs mb-1">Aggregation</label>
                <div className="flex gap-1 flex-wrap">
                  {(['count', 'sum', 'avg', 'min', 'max'] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => setPivotAgg(a)}
                      className={`px-2.5 py-1 text-xs font-medium rounded border transition-all ${
                        pivotAgg === a
                          ? 'bg-coffee-700 text-white border-coffee-700'
                          : 'bg-white border-gray-200 text-gray-600 hover:border-coffee-400'
                      }`}
                    >
                      {a.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Subtotals */}
              {pivotRows.length > 1 && (
                <div>
                  <label className="label text-xs mb-1">Subtotals</label>
                  <div className="bg-white border border-gray-200 rounded-md py-1 w-40">
                    {pivotRows.slice(0, -1).map((f) => (
                      <label key={f} className="flex items-center gap-2 px-2.5 py-1 cursor-pointer hover:bg-gray-50 select-none">
                        <input
                          type="checkbox"
                          checked={pivotSubtotalFields.includes(f)}
                          onChange={() => setPivotSubtotalFields((prev) =>
                            prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]
                          )}
                          className="rounded flex-shrink-0"
                        />
                        <span className="text-xs text-gray-700 truncate">By {FIELD_LABELS[f] ?? f}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {pivotResult && (
                <div className="flex items-end">
                  <button onClick={printPivot} className="btn btn-secondary btn-sm gap-1.5">
                    <Printer className="w-4 h-4" /> Print PDF
                  </button>
                </div>
              )}

              {/* Pivot Filters */}
              <div className="w-full border-t border-coffee-200 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="label text-xs mb-0">Pivot Filters</span>
                  <button
                    onClick={() => setPivotFilters((prev) => [...prev, { id: Date.now(), field: '', op: '=', value: '' }])}
                    className="text-xs text-coffee-700 hover:underline font-medium"
                  >
                    + Add Filter
                  </button>
                </div>
                {pivotFilters.length > 0 && (
                  <div className="flex flex-col gap-1.5">
                    {pivotFilters.map((pf) => (
                      <div key={pf.id} className="flex items-center gap-1.5">
                        <select
                          value={pf.field}
                          onChange={(e) => setPivotFilters((prev) => prev.map((x) => x.id === pf.id ? { ...x, field: e.target.value } : x))}
                          className="select py-1 text-xs flex-1 min-w-0"
                        >
                          <option value="">Field…</option>
                          {orderedFields.map((f) => <option key={f} value={f}>{FIELD_LABELS[f] ?? f}</option>)}
                        </select>
                        <select
                          value={pf.op}
                          onChange={(e) => setPivotFilters((prev) => prev.map((x) => x.id === pf.id ? { ...x, op: e.target.value } : x))}
                          className="select py-1 text-xs w-28"
                        >
                          <option value="=">= equals</option>
                          <option value="!=">≠ not equal</option>
                          <option value="contains">contains</option>
                          <option value="starts">starts with</option>
                          <option value=">">{'> greater'}</option>
                          <option value="<">{'< less'}</option>
                          <option value=">=">{'>= ≥'}</option>
                          <option value="<=">{'<= ≤'}</option>
                        </select>
                        <input
                          type="text"
                          value={pf.value}
                          onChange={(e) => setPivotFilters((prev) => prev.map((x) => x.id === pf.id ? { ...x, value: e.target.value } : x))}
                          placeholder="Value… (comma-separate for multiple)"
                          className="input py-1 text-xs flex-1 min-w-0"
                        />
                        <button
                          onClick={() => setPivotFilters((prev) => prev.filter((x) => x.id !== pf.id))}
                          className="text-gray-400 hover:text-red-500 transition-colors p-0.5 flex-shrink-0"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Results Table */}
          <div className="flex-1 bg-white rounded-lg border border-gray-200 flex flex-col min-h-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <p className="text-sm font-semibold text-gray-700">
                {pivotMode && pivotResult ? (
                  <>
                    Pivot: <span className="text-coffee-700">{pivotResult.rowLabel}</span>
                    {pivotCol ? <> &times; <span className="text-coffee-700">{FIELD_LABELS[pivotCol] ?? pivotCol}</span></> : null}
                    {' → '}
                    <span className="font-normal text-gray-500">
                      {pivotAgg}{pivotAgg !== 'count' && pivotValues.length > 0 ? `(${pivotValues.map((vf) => FIELD_LABELS[vf] ?? vf).join(', ')})` : ''}
                    </span>
                  </>
                ) : hasRun ? (
                  <>
                    <span className="text-coffee-700 font-bold">{rows.length.toLocaleString()}</span>
                    {' rows'}
                    {rows.length === 2000 && (
                      <span className="ml-2 text-xs text-amber-600 font-normal">(limit reached — add filters to narrow results)</span>
                    )}
                  </>
                ) : (
                  <span className="text-gray-400">Configure your report and click Run Report</span>
                )}
              </p>
              {pivotMode && pivotResult ? (
                <span className="text-xs text-gray-400">{pivotResult.hierarchicalRows.length} rows × {pivotResult.colDefs.length} col{pivotResult.colDefs.length !== 1 ? 's' : ''}</span>
              ) : hasRun && rows.length > 0 ? (
                <p className="text-xs text-gray-400">{orderedFields.length} columns</p>
              ) : null}
            </div>
            <div className="overflow-auto flex-1">
              {pivotMode && pivotResult ? (
                <table id="pivot-table-inner" className="w-full text-sm border-collapse min-w-max">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50 border-b border-gray-200">
                      {pivotResult.rowFields.map((f) => (
                        <th key={f} className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
                          {FIELD_LABELS[f] ?? f}
                        </th>
                      ))}
                      {pivotResult.colDefs.map((cd) => (
                        <th key={cd.key} className="px-3 py-2 text-right text-xs font-semibold text-gray-600 uppercase tracking-wide whitespace-nowrap">
                          {cd.label}
                        </th>
                      ))}
                      {pivotResult.rowTotalDefs.map((td) => (
                        <th key={td.vf} className="px-3 py-2 text-right text-xs font-semibold text-coffee-700 uppercase tracking-wide border-l border-gray-200 whitespace-nowrap">
                          {td.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      const result: React.ReactElement[] = [];
                      let prev: string[] = [];

                      // Subtotal level indices sorted deepest-first so we emit innermost before outer
                      const subLevels = pivotSubtotalFields
                        .map((sf) => pivotResult.rowFields.indexOf(sf))
                        .filter((idx) => idx >= 0 && idx < pivotResult.rowFields.length - 1)
                        .sort((a, b) => b - a);

                      const emitSubtotals = (prevVals: string[], minLevel: number) => {
                        for (const lvl of subLevels) {
                          if (lvl < minLevel) continue;
                          const prefixKey = prevVals.slice(0, lvl + 1).join('\x00');
                          const sub = pivotResult.subtotalMap.get(`${lvl}\x00${prefixKey}`);
                          if (!sub) continue;
                          result.push(
                            <tr key={`sub__${lvl}__${prefixKey}`} className="border-t border-coffee-200">
                              {pivotResult.rowFields.map((_, idx) => (
                                <td
                                  key={idx}
                                  className={`py-1.5 text-xs whitespace-nowrap ${idx === lvl ? 'font-semibold text-coffee-900' : 'text-gray-400'}`}
                                  style={{ paddingLeft: `${12 + idx * 14}px`, paddingRight: '12px', background: '#ede8e3' }}
                                >
                                  {idx < lvl ? prevVals[idx] : idx === lvl ? `${prevVals[lvl]} — Total` : ''}
                                </td>
                              ))}
                              {pivotResult.colDefs.map((cd) => (
                                <td key={cd.key} className="px-3 py-1.5 text-right tabular-nums text-xs font-semibold text-coffee-900" style={{ background: '#ede8e3' }}>
                                  {formatPivotVal(sub.cells[cd.key] ?? 0, cd.vf)}
                                </td>
                              ))}
                              {pivotResult.rowTotalDefs.map((td) => (
                                <td key={td.vf} className="px-3 py-1.5 text-right tabular-nums text-xs font-semibold text-coffee-900 border-l border-coffee-300" style={{ background: '#ede8e3' }}>
                                  {formatPivotVal(sub.rowTotals[td.vf] ?? 0, td.vf)}
                                </td>
                              ))}
                            </tr>
                          );
                        }
                      };

                      pivotResult.hierarchicalRows.forEach((row, i) => {
                        const firstDiff = i === 0 ? 0 : row.fieldValues.findIndex((v, idx) => v !== prev[idx]);
                        if (i > 0 && firstDiff !== -1) emitSubtotals(prev, firstDiff);

                        const showFrom = firstDiff === -1 ? row.fieldValues.length : firstDiff;
                        const display = row.fieldValues.map((v, idx) => idx >= showFrom ? v : '');
                        const isNewTopGroup = i > 0 && firstDiff === 0;
                        prev = [...row.fieldValues];

                        result.push(
                          <tr
                            key={row.fieldValues.join('\x00')}
                            className={`hover:bg-gray-50 border-b border-gray-50 ${isNewTopGroup ? 'border-t-2 border-t-gray-300' : ''}`}
                          >
                            {display.map((val, idx) => (
                              <td
                                key={idx}
                                className="py-2 text-gray-900 whitespace-nowrap"
                                style={{
                                  paddingLeft: `${12 + idx * 14}px`,
                                  paddingRight: '12px',
                                  fontWeight: val && idx === 0 ? 600 : val ? 500 : 400,
                                  color: val ? undefined : 'transparent',
                                }}
                              >
                                {val || '–'}
                              </td>
                            ))}
                            {row.cells && pivotResult.colDefs.map((cd) => (
                              <td key={cd.key} className="px-3 py-2 text-right tabular-nums text-gray-700">
                                {formatPivotVal(row.cells[cd.key] ?? 0, cd.vf)}
                              </td>
                            ))}
                            {pivotResult.rowTotalDefs.map((td) => (
                              <td key={td.vf} className="px-3 py-2 text-right tabular-nums font-semibold text-coffee-700 border-l border-gray-200">
                                {formatPivotVal(row.rowTotals[td.vf] ?? 0, td.vf)}
                              </td>
                            ))}
                          </tr>
                        );
                      });

                      // Emit subtotals after the last row
                      if (prev.length > 0) emitSubtotals(prev, 0);

                      return result;
                    })()}
                  </tbody>
                  <tfoot>
                    <tr className="bg-coffee-50 border-t-2 border-coffee-200 font-semibold">
                      <td className="px-3 py-2 text-gray-900" colSpan={pivotResult.rowFields.length}>Total</td>
                      {pivotResult.colDefs.map((cd) => (
                        <td key={cd.key} className="px-3 py-2 text-right tabular-nums text-coffee-800">
                          {formatPivotVal(pivotResult.colTotals[cd.key] ?? 0, cd.vf)}
                        </td>
                      ))}
                      {pivotResult.rowTotalDefs.map((td) => (
                        <td key={td.vf} className="px-3 py-2 text-right tabular-nums text-coffee-800 border-l border-gray-200">
                          {formatPivotVal(pivotResult.grandTotals[td.vf] ?? 0, td.vf)}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              ) : pivotMode && hasRun && rows.length > 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-300 py-16">
                  <Grid3x3 className="w-12 h-12 mb-3" />
                  <p className="text-sm text-gray-400">Select Rows and Values above to build your pivot table</p>
                </div>
              ) : hasRun && rows.length > 0 ? (
                <table className="w-full text-sm border-collapse min-w-max">
                  <thead className="sticky top-0 z-10">
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-gray-400 w-10">#</th>
                      {orderedFields.map((f) => {
                        const active = sortKey === f;
                        return (
                          <th
                            key={f}
                            onClick={() => requestSort(f)}
                            className={`px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap cursor-pointer select-none group transition-colors ${
                              active ? 'text-gray-800' : 'text-gray-600 hover:text-gray-800'
                            }`}
                          >
                            <div className="flex items-center gap-1">
                              {FIELD_LABELS[f] ?? f}
                              <span className={`flex-shrink-0 ${active ? 'text-coffee-700' : 'text-gray-300 group-hover:text-gray-400'}`}>
                                {active ? (
                                  sortDir === 'asc'
                                    ? <ChevronUp className="w-3 h-3" />
                                    : <ChevronDown className="w-3 h-3" />
                                ) : (
                                  <ChevronsUpDown className="w-3 h-3" />
                                )}
                              </span>
                            </div>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {displayRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-3 py-2 text-xs text-gray-400 tabular-nums">{i + 1}</td>
                        {orderedFields.map((f) => (
                          <td key={f} className="px-3 py-2 text-gray-800 whitespace-nowrap max-w-xs truncate">{row[f] ?? ''}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : hasRun && rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16">
                  <p className="font-medium">No results</p>
                  <p className="text-sm mt-1">Try adjusting your filters or date range</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-300 py-16">
                  <FileSpreadsheet className="w-12 h-12 mb-3" />
                  <p className="text-sm text-gray-400">Select fields and run your report</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Save Report Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setShowSaveModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-lg font-bold">Save Report</h2>
              <button onClick={() => setShowSaveModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveReport} className="p-6 space-y-4">
              <div>
                <label className="label">Report Name *</label>
                <input className="input" value={saveName} onChange={(e) => setSaveName(e.target.value)} placeholder="e.g. Monthly Sales Summary" autoFocus required />
              </div>
              <p className="text-xs text-gray-400">
                Saves: <span className="font-medium capitalize">{source}</span> source · {selectedFields.size} fields selected
              </p>
              <div className="flex gap-3">
                <button type="button" onClick={() => setShowSaveModal(false)} className="btn btn-secondary flex-1 justify-center">Cancel</button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1 justify-center gap-2">
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving…' : 'Save Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
