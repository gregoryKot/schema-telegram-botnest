import { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import { buildPlusActions, type QuickActionId } from '../../../shared/src/quickActions/quickActions';
import type { TherapyClientSummary, UserId } from '../api';
import { isActiveToday } from '../../../shared/src/therapy/clientSheetHelpers';
import { clientAvatarInitials, clientDisplayName } from '../../../shared/src/therapy/clientInitials';
import { clientStatus } from './therapist/rosterOrder';
import { matchesSearch } from '../../../shared/src/utils/searchNormalize';
import { clientHue } from '../lib/tone';
import { CmdList, type CmdRow } from './CommandPaletteList';
import { QUICK_ACTION_SIGN } from './quickActionSign';
import { SECTION_LOOK } from './appShell/navLook';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';
import { useHistorySheet } from '../hooks/useHistorySheet';
import type { Section } from './appShell/navigation';
import { useScreenShare } from './appShell/screenShareMode';
import '../styles/command-palette.css';

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
  { id: 'diary',   label: 'Записи',   sub: 'Дневники',  hint: '⌘ 2' },
  { id: 'more',    label: 'Ещё',      sub: 'Всё остальное', hint: '⌘ 3' },
  { id: 'schemas', label: 'Паттерны', sub: '20 схем',   hint: '' },
  { id: 'profile', label: 'Профиль',  sub: 'Аккаунт',   hint: '' },
  { id: 'practice', label: 'Практики', sub: 'Дыхание, упражнения, планы', hint: '' },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function CommandPalette({ onNavigate, onClose, userRole, therapistMode, onToggleMode, onOpenClient, onQuickAction }: Props) {
  const tr = useTr();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [clients, setClients] = useState<TherapyClientSummary[]>([]);
  // «Показ экрана» (сайдбар кабинета): имён клиентов нет и здесь, даже по поиску.
  const screenShare = useScreenShare();
  const inputRef = useRef<HTMLInputElement>(null);
  // «Назад» браузера закрывает палитру; действие строки — goBack(action), после снятия
  // записи. Escape — через стек диалогов: поверх палитры закроет только верхнее окно.
  const goBack = useHistorySheet(onClose);
  const dialogA11y = useDialogA11y({ onEscape: goBack });
  // Выделение — на первую строку при смене запроса (состояние в рендере, не в эффекте).
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) { setPrevQ(q); setSel(0); }

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Fetch clients for therapists
  useEffect(() => {
    if (userRole === 'THERAPIST') {
      api.getTherapyClients().then(setClients).catch(() => {});
    }
  }, [userRole]);

  const rows = useMemo<CmdRow[]>(() => {
    const clientRows: CmdRow[] = screenShare ? [] : clients.map(c => ({
      label: clientDisplayName(c),
      ...(isActiveToday(c) ? { sub: 'Активность сегодня' } : { sub: clientStatus(c).label }),
      hint: 'Открыть карточку',
      mark: { initials: clientAvatarInitials(c), hue: clientHue(c.telegramId) },
      search: clientDisplayName(c),
      action: () => onOpenClient?.(c.telegramId),
    }));

    // In therapist cabinet — skip client navigation sections
    const navRows: CmdRow[] = therapistMode ? [] : NAV_ITEMS.map(n => ({
      label: n.label, sub: n.sub, hint: n.hint, mark: { sign: SECTION_LOOK[n.id].sign },
      search: `${n.label} ${n.sub}`,
      action: () => onNavigate(n.id),
    }));

    const toggle = therapistMode ? 'Переключиться в режим клиента' : 'Переключиться в кабинет терапевта';
    const toggleSub = therapistMode ? 'Клиентский вид' : 'Кабинет';
    const actionRows: CmdRow[] = [
      ...(userRole === 'THERAPIST' ? [{
        label: toggle, sub: toggleSub, mark: { sign: 'cluster' as const }, search: `${toggle} ${toggleSub}`,
        action: () => onToggleMode?.(),
      }] : []),
      // Те же быстрые действия, что в «+» на телефоне (общий реестр); группа — подписью над строками.
      ...(!therapistMode ? buildPlusActions(tr).flatMap(g => g.actions.map(a => ({
        group: g.title, label: a.label, sub: a.sub, mark: { sign: QUICK_ACTION_SIGN[a.id] },
        search: `${a.label} ${g.title} ${a.sub}`,
        action: () => onQuickAction?.(a.id),
      }))) : []),
    ];

    // Регистр и «ё/е» не различаются — тот же поиск, что в списке клиентов.
    return [...clientRows, ...navRows, ...actionRows].filter(r => matchesSearch(r.search, q));
  }, [q, clients, screenShare, userRole, therapistMode, onNavigate, onOpenClient, onToggleMode, onQuickAction, tr]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(rows.length - 1, s + 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSel(s => Math.max(0, s - 1)); }
      if (e.key === 'Enter')     { e.preventDefault(); goBack(rows[sel]?.action); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, sel, goBack]);

  return (
    <div className="cmd-backdrop" onClick={goBack} role="button" tabIndex={0} aria-label="Закрыть"
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goBack(); } }}>
      {/* onClick/onKeyDown — stopPropagation: клик или Enter/Space (печатая в
          поиске) не должны всплыть до бэкдропа и закрыть палитру. role="dialog"
          не входит в «интерактивные» роли jsx-a11y — ложное срабатывание. */}
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        {...dialogA11y}
        className="ds-card ds-card--flush cmd-panel"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.stopPropagation(); } }}
      >
        <div className="cmd-search">
          <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="cmd-icon">
            <path d="M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zM21 21l-4.35-4.35" />
          </svg>
          <input
            ref={inputRef}
            className="ds-input ds-input--search"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder={userRole === 'THERAPIST' && !screenShare ? 'Клиент, страница, действие…' : 'Найти страницу или действие…'}
          />
        </div>
        {/* «Показ экрана»: одна строка почему клиентов нет — без второй «Ничего не найдено» под ней. */}
        <CmdList rows={rows} sel={sel} onSelect={setSel} onRun={(row) => goBack(row.action)}
                 note={screenShare && userRole === 'THERAPIST' ? 'Клиенты скрыты: включён показ экрана' : undefined} />
      </div>
    </div>
  );
}
