import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import type { SortDir } from '@/hooks/useTableSort';

interface Props {
  label: string;
  sortKey: string;
  currentKey: string | null;
  dir: SortDir;
  onSort: (key: string) => void;
  className?: string;
  align?: 'left' | 'right';
}

export function SortableHeader({ label, sortKey, currentKey, dir, onSort, className = '', align = 'left' }: Props) {
  const active = currentKey === sortKey;
  return (
    <th
      onClick={() => onSort(sortKey)}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : undefined}
      className={`text-left px-5 py-3 text-xs font-semibold uppercase tracking-wide cursor-pointer select-none group transition-colors ${
        active ? 'text-gray-800' : 'text-gray-500 hover:text-gray-700'
      } ${className}`}
    >
      <div className={`flex items-center gap-1 ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        <span className={`flex-shrink-0 transition-colors ${active ? 'text-coffee-700' : 'text-gray-300 group-hover:text-gray-400'}`}>
          {active ? (
            dir === 'asc' ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronsUpDown className="w-3.5 h-3.5" />
          )}
        </span>
      </div>
    </th>
  );
}
