import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { buildPlusActions, type QuickActionId } from '../../../shared/src/quickActions/quickActions';
import type { TherapyClientSummary, UserId } from '../api';
import { todayCalendarDate } from '../../../shared/src/utils/calendarDate';
import { pressable } from '../utils/a11y';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';
import type { Section } from './appShell/navigation';
import '../styles/sheet-tasks.css';


interface Props {
  section: Section;
  onNavigate: (s: Section) => void;
  onClose: () => void;
  userRole?: 'CLIENT' | 'THERAPIST';
  therapistMode?: boolean;
  onToggleMode?: () => void;
  onOpenClient?: (id: UserId) => void;
  onQuickAction?: (id: QuickActionId) => void;
}

const NAV_ITEMS: { id: Section; label: string; sub: string; hint: string }[] = [
  { id: 'today',   label: 'Сегодня',  sub: 'Главная',   hint: '⌘ 1' },
  { id: 'diary',   label: 'Дневник',  sub: 'Записи',    hint: '⌘ 2' },
  { id: 'more',    label: 'Ещё',      sub: 'Всё остальное', hint: '⌘ 3' },
  { id: 'schemas', label: 'Паттерны', sub: '20 схем',   hint: '' },
  { id: 'profile', label: 'Профиль',  sub: 'Аккаунт',   hint: '' },
  { id: 'practice', label: 'Практика', sub: 'Практики',  hint: '' },
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

export function CommandPalette({ onNavigate, onClose, userRole, therapistMode, onToggleMode, onOpenClient, onQuickAction }: Props) {
  const tr = useTr();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [clients, setClients] = useState<TherapyClientSummary[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  // Escape — через стек диалогов: поверх палитры он закроет только верхнее окно.
  const dialogA11y = useDialogA11y({ onEscape: onClose });

  // Reset the highlighted row to the top whenever the query changes. Adjusting
  // state during render (not in an effect) is the documented pattern for
  // deriving state from a changing value.
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) { setPrevQ(q); setSel(0); }

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Fetch clients for therapists
  useEffect(() => {
    if (userRole === 'THERAPIST') {
      api.getTherapyClients().then(setClients).catch(() => {});
    }
  }, [userRole]);

  type RowType = 'client' | 'nav' | 'action';
  interface Row { type: RowType; label: string; sub?: string; activeToday?: boolean; hint?: string; action: () => void }

  const rows = useMemo<Row[]>(() => {
    const today = todayCalendarDate();
    const term = q.trim().toLowerCase();

    const clientRows: Row[] = clients.map(c => ({
      type: 'client' as const,
      label: c.clientAlias ?? c.name ?? `ID ${c.telegramId}`,
      ...(c.lastActiveDate === today ? { sub: 'Активность сегодня', activeToday: true } : { sub: 'Клиент' }),
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
      // Те же быстрые действия, что в «+» на телефоне (общий реестр).
      ...(!therapistMode ? buildPlusActions(tr).flatMap(g => g.actions.map(a => ({ a, group: g.title }))).map(({ a, group }) => ({
        type: 'action' as const,
        label: a.label,
        sub: `${group} · ${a.sub}`,
        action: () => onQuickAction?.(a.id),
      })) : []),
    ];

    const all: Row[] = [...clientRows, ...navRows, ...actionRows];
    if (!term) return all;
    return all.filter(r => (r.label + ' ' + (r.sub ?? '')).toLowerCase().includes(term));
  }, [q, clients, userRole, therapistMode, onNavigate, onOpenClient, onToggleMode, onQuickAction, tr]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(rows.length - 1, s + 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
      if (e.key === 'Enter')     { e.preventDefault(); rows[sel]?.action(); onClose(); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, sel, onClose]);

  return (
    <div className="sk-cmd-bg" onClick={onClose} role="button" tabIndex={0} aria-label="Закрыть"
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClose(); } }}>
      {/* onClick/onKeyDown — stopPropagation: клик или Enter/Space (печатая в
          поиске) не должны всплыть до бэкдропа и закрыть палитру. role="dialog"
          не входит в «интерактивные» роли jsx-a11y — ложное срабатывание. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        {...dialogA11y}
        className="ds-card ds-card--flush sk-cmd-panel"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); } }}
      >
        <div className="sk-cmd-search">
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="sk-cmd-ic">
            <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            className="ds-input sk-cmd-input"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Найти клиента, страницу или действие…"
          />
          <span className="kbd">Esc</span>
        </div>
        <div className="sk-cmd-list">
          {rows.length === 0 && <div className="ds-list-row sk-cmd-empty ds-sub">Ничего не найдено</div>}
          {rows.map((row, i) => (
            <div
              key={i}
              className={`ds-list-row ds-list-row--hover sk-cmd-row${i === sel ? ' is-sel' : ''}`}
              onMouseEnter={() => setSel(i)}
              {...pressable(() => { row.action(); onClose(); })}
            >
              <span className="sk-cmd-ic">
                {row.type === 'client' ? <IconPerson /> : row.type === 'nav' ? <IconArrow /> : <IconBolt />}
              </span>
              <span className="sk-cmd-main">
                <span className="sk-cmd-label">{row.label}</span>
                {row.sub && (
                  <span className={'sk-cmd-sub' + (row.activeToday ? ' is-ok' : '')}>
                    {row.sub}
                  </span>
                )}
              </span>
              {row.hint && <span className="kbd">{row.hint}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
