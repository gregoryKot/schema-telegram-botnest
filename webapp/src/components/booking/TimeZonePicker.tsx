import { useState } from 'react';
import { TIME_ZONE_OPTIONS } from '../../../../shared/src/utils/timeZoneNames';

const linkSt: React.CSSProperties = {
  background: 'none', border: 'none', padding: 0, fontSize: 12,
  color: 'var(--text-faint)', textDecoration: 'underline', cursor: 'pointer', fontFamily: 'inherit',
};

/**
 * «не ваш часовой пояс?» — раскрывает выбор из словаря популярных поясов.
 * Ручной выбор перерисовывает ленту слотов (родитель держит state).
 */
export function TimeZonePicker({ tz, onChange }: { tz: string; onChange: (tz: string) => void }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" style={linkSt} onClick={() => setOpen(true)}>
        не ваш часовой пояс?
      </button>
    );
  }

  return (
    <label style={{ display: 'inline-flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--text-faint)' }}>
      Часовой пояс
      <select
        value={tz}
        onChange={(e) => onChange(e.target.value)}
        style={{
          minHeight: 44, padding: '8px 10px', fontSize: 14, fontFamily: 'inherit',
          borderRadius: 'var(--r-12)', border: '1.5px solid var(--line-strong)',
          background: 'var(--bg)', color: 'var(--text)',
        }}
      >
        {!TIME_ZONE_OPTIONS.some((o) => o.tz === tz) && <option value={tz}>{tz}</option>}
        {TIME_ZONE_OPTIONS.map((o) => (
          <option key={o.tz} value={o.tz}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
