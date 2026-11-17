'use client';

import { GROUP_NUMBERS } from '@/lib/marketplace';

// Group number picker for the seller and buyer forms: 1–14, or "None" with a reason.
// value.group is '' (not chosen yet), 'none', or '1'–'14'.
export interface GroupValue { group: string; reason: string }

export const emptyGroup: GroupValue = { group: '', reason: '' };

// Shape for the API: a number, or null for "None"
export const groupPayload = (v: GroupValue) => ({
  group_number: v.group === 'none' ? null : Number(v.group),
  no_group_reason: v.group === 'none' ? v.reason.trim() : null,
});

// Returns an error message, or '' when the choice is complete
export const groupError = (v: GroupValue) =>
  !v.group ? 'Choose your group number' : v.group === 'none' && !v.reason.trim() ? 'Tell us why you don’t have a group number' : '';

export function GroupField({ id, value, onChange, disabled }: { id: string; value: GroupValue; onChange: (v: GroupValue) => void; disabled?: boolean }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="label" htmlFor={id}>Group number *</label>
        <select id={id} className="select" value={value.group} onChange={(e) => onChange({ ...value, group: e.target.value })} required disabled={disabled}>
          <option value="" disabled>Choose…</option>
          {GROUP_NUMBERS.map((n) => <option key={n} value={n}>Group {n}</option>)}
          <option value="none">None</option>
        </select>
      </div>
      {value.group === 'none' && (
        <div>
          <label className="label" htmlFor={`${id}-reason`}>Why don’t you have a group number? *</label>
          <input
            id={`${id}-reason`}
            className="input"
            value={value.reason}
            onChange={(e) => onChange({ ...value, reason: e.target.value })}
            required
            maxLength={300}
            disabled={disabled}
            placeholder="e.g. Visiting from another locale"
          />
        </div>
      )}
    </div>
  );
}
