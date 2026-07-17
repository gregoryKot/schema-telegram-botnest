import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api';
import type { TherapyClientSummary } from '../api';
import { todayStr } from '../utils/format';

type Section = 'today' | 'diary' | 'schemas' | 'profile' | 'practice';

interface Props {
  section: Section;
  onNavigate: (s: Section) => void;
  onClose: () => void;
  userRole?: 'CLIENT' | 'THERAPIST';
  therapistMode?: boolean;
  onToggleMode?: () => void;
  onOpenClient?: (id: number) => void;
  onNewDiaryEntry?: () => void;
}

const NAV_ITEMS: { id: Section; label: string; sub: string; hint: string }[] = [
  { id: 'today',   label: 'Сегодня',  sub: 'Главная',   hint: '⌘ 1' },
  { id: 'diary',   label: 'Дневник',  sub: 'Записи',    hint: '⌘ 2' },
  { id: 'schemas', label: 'Паттерны', sub: '20 схем',   hint: '⌘ 3' },
  { id: 'profile', label: 'Профиль',  sub: 'Аккаунт',   hint: '⌘ 4' },
  { id: 'practice', label: 'Практика', sub: 'Практики',  hint: '⌘ 5' },
];

// ── Icons ──────────────────────────────────────────────────────────────────────

function IconPerson() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <circle cx={12} cy={8} r={4} />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  );
}

function IconBolt() {
  return (
    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CommandPalette({ onNavigate, onClose, userRole, therapistMode, onToggleMode, onOpenClient, onNewDiaryEntry }: Props) {
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [clients, setClients] = useState<TherapyClientSummary[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Fetch clients for therapists
  useEffect(() => {
    if (userRole === 'THERAPIST') {
      api.getTherapyClients().then(setClients).catch(() => {});
    }
  }, [userRole]);

  type RowType = 'client' | 'nav' | 'action';
  interface Row { type: RowType; label: string; sub?: string; hint?: string; action: () => void }

  const rows = useMemo<Row[]>(() => {
    const today = todayStr();
    const term = q.trim().toLowerCase();

    const clientRows: Row[] = clients.map(c => ({
      type: 'client' as const,
      label: c.clientAlias ?? c.name ?? `ID ${c.telegramId}`,
      sub: c.lastActiveDate === today ? 'Активен сегодня' : 'Клиент',
      hint: 'Открыть карточку',
      action: () => onOpenClient?.(c.telegramId),
    }));

    // In therapist cabinet — skip client navigation sections
    const navRows: Row[] = therapistMode ? [] : NAV_ITEMS.map(n => ({
      type: 'nav' as const,
      label: n.label, sub: n.sub, hint: n.hint,
      action: () => onNavigate(n.id),
    }));

    const actionRows: Row[] = [
      ...(userRole === 'THERAPIST' ? [{
        type: 'action' as const,
        label: therapistMode ? 'Переключиться в режим клиента' : 'Переключиться в кабинет терапевта',
        sub: therapistMode ? 'Клиентский вид' : 'Кабинет',
        action: () => onToggleMode?.(),
      }] : []),
      ...(!therapistMode ? [{
        type: 'action' as const,
        label: 'Новая запись в дневник',
        action: () => { onNewDiaryEntry?.(); },
      }] : []),
    ];

    const all: Row[] = [...clientRows, ...navRows, ...actionRows];
    if (!term) return all;
    return all.filter(r => (r.label + ' ' + (r.sub ?? '')).toLowerCase().includes(term));
  }, [q, clients, userRole, therapistMode, onNavigate, onOpenClient, onToggleMode, onNewDiaryEntry]);

  // eslint-disable-next-line react-hooks/set-state-in-effect -- намеренно: загрузка/сброс состояния при монтировании или смене зависимости (fetch-эффект); рефактор на key/data-layer — отдельная задача
  useEffect(() => { setSel(0); }, [q]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(rows.length - 1, s + 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
      if (e.key === 'Enter')     { e.preventDefault(); rows[sel]?.action(); onClose(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, sel, onClose]);

  return (
    <div className="cmd-bg" onClick={onClose}>
      <div className="cmd-panel" onClick={e => e.stopPropagation()}>
        <div className="cmd-search">
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-faint)', flexShrink: 0 }}>
            <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Найти клиента, страницу или действие…"
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="cmd-list">
          {rows.length === 0 && <div style={{ padding: '24px 20px', color: 'var(--text-faint)', fontSize: 13 }}>Ничего не найдено</div>}
          {rows.map((row, i) => (
            <div
              key={i}
              className={`cmd-row${i === sel ? ' is-sel' : ''}`}
              onMouseEnter={() => setSel(i)}
              onClick={() => { row.action(); onClose(); }}
            >
              <span style={{ color: 'var(--text-faint)', flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                {row.type === 'client' ? <IconPerson /> : row.type === 'nav' ? <IconArrow /> : <IconBolt />}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ color: 'var(--text)' }}>{row.label}</span>
                {row.sub && (
                  <span style={{ marginLeft: 8, fontSize: 11, color: row.sub === 'Активен сегодня' ? 'var(--c-moss)' : 'var(--text-faint)' }}>
                    {row.sub}
                  </span>
                )}
              </span>
              {row.hint && <span className="hint" style={{ fontSize: 11 }}>{row.hint}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
