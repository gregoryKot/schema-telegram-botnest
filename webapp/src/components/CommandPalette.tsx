import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useTr } from '../utils/addressForm';
import type { QuickActionId } from '../../../shared/src/quickActions/quickActions';
import { trackSearchResultOpen } from '../../../shared/src/share/searchAnalytics';
import type { TherapyClientSummary, UserId } from '../api';
import { CmdList, type CmdRow } from './CommandPaletteList';
import { CMD_LIST_ID, cmdOptionId } from './commandPalette/listIds';
import { searchPalette, paletteExamples, paletteHelp, GROUP } from './commandPalette/paletteRows';
import { pushRecent, readRecent } from './commandPalette/paletteRecent';
import { usePaletteGuide } from './commandPalette/usePaletteGuide';
import { GUIDE_PATH, guideSheetState } from '../sections/guide/guideSheetRoute';
import { useDialogA11y } from '../../../shared/src/utils/dialogA11y';
import { useHistorySheet } from '../hooks/useHistorySheet';
import { useVisualViewportHeight } from '../hooks/useVisualViewportHeight';
import type { Section } from './appShell/navigation';
import { useScreenShare } from './appShell/screenShareMode';
import '../styles/command-palette.css';

interface Props {
  onNavigate: (s: Section) => void;
  onClose: () => void;
  userRole?: 'CLIENT' | 'THERAPIST';
  therapistMode?: boolean;
  onToggleMode?: () => void;
  onOpenClient?: (id: UserId) => void;
  onQuickAction?: (id: QuickActionId) => void;
}

/**
 * Общий поиск ⌘K: клиенты, разделы, листы «Справочника» (кабинет терапевта) и действия. Строки собирает
 * commandPalette/paletteRows.ts; выбор листа ведёт на /cabinet/guide с состоянием маршрута, лист открывает
 * справочник (guideSheetRoute.ts). Открытие результата — событие search_result_open без текста запроса
 * и ключ строки в «Недавнее» (paletteRecent.ts). На телефоне панель — во весь видимый экран над клавиатурой.
 */
function placeholder(therapist: boolean, cabinet: boolean, screenShare: boolean): string {
  if (cabinet) return screenShare ? 'Лист справочника, раздел…' : 'Клиент, лист справочника, раздел…';
  return therapist && !screenShare ? 'Клиент, страница, действие…' : 'Найти страницу или действие…';
}

/** Высота и сдвиг видимой области — переменными для телефонной раскладки (command-palette.css). */
function viewportVars(viewport: { height: number; offsetTop: number } | null): CSSProperties | undefined {
  if (!viewport) return undefined;
  return { '--cmd-vvh': `${viewport.height}px`, '--cmd-vvt': `${viewport.offsetTop}px` } as CSSProperties;
}

export function CommandPalette({ onNavigate, onClose, userRole, therapistMode, onToggleMode, onOpenClient, onQuickAction }: Props) {
  const tr = useTr();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [clients, setClients] = useState<TherapyClientSummary[]>([]);
  // «Показ экрана» (сайдбар кабинета): имён клиентов нет и здесь, даже по поиску.
  const screenShare = useScreenShare();
  const inputRef = useRef<HTMLInputElement>(null);
  // «Недавнее» читается один раз при открытии: открытая сейчас строка появится в нём в следующий раз.
  const [recent] = useState(readRecent);
  const viewport = useVisualViewportHeight();
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

  const therapist = userRole === 'THERAPIST';
  const cabinet = therapist && !!therapistMode;
  const guide = usePaletteGuide(cabinet, tr);
  const found = useMemo(() => searchPalette({
    query: q, tr, therapist, therapistMode: !!therapistMode, screenShare, clients, guide, recent,
    run: {
      section: onNavigate,
      path: (to) => { navigate(to); },
      client: (id) => onOpenClient?.(id),
      toggleMode: () => onToggleMode?.(),
      quick: (id) => onQuickAction?.(id),
      guideSheet: (target) => { navigate(GUIDE_PATH, { state: guideSheetState(target) }); },
    },
  }), [q, tr, therapist, therapistMode, screenShare, clients, guide, recent, navigate, onNavigate, onOpenClient, onToggleMode, onQuickAction]);
  const rows = found.rows;
  const examples = useMemo(() => paletteExamples(guide), [guide]);
  const typed = q.trim() !== '';
  // Действие строки — после снятия записи палитры; в событие уходит вид строки, не запрос.
  const run = (row: CmdRow | undefined) => {
    if (!row) return;
    trackSearchResultOpen(api, row.kind, typed, row.group === GROUP.recent);
    pushRecent(row.key);
    goBack(row.action);
  };
  const runRef = useRef(run);
  useEffect(() => { runRef.current = run; });

  useEffect(() => {
    const last = rows.length - 1;
    // Клавиатурный выбор прокручивается в видимую область; первая строка — список в самый верх (видна подпись группы).
    function move(e: KeyboardEvent, to: number) {
      e.preventDefault();
      if (to < 0) return;
      setSel(to);
      const list = document.getElementById(CMD_LIST_ID)?.parentElement;
      if (to === 0 && list) list.scrollTop = 0;
      else document.getElementById(cmdOptionId(to))?.scrollIntoView?.({ block: 'nearest' });
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') move(e, Math.min(last, sel + 1));
      if (e.key === 'ArrowUp')   move(e, Math.max(0, sel - 1));
      if (e.key === 'Home' && !typed) move(e, Math.min(last, 0));
      if (e.key === 'End' && !typed)  move(e, last); // набран запрос — Home и End остаются полю
      if (e.key === 'Enter')     { e.preventDefault(); runRef.current(rows[sel]); }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, sel, typed]);

  return (
    <div className="cmd-backdrop" onClick={goBack} role="button" tabIndex={0} aria-label="Закрыть" style={viewportVars(viewport)}
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
            placeholder={placeholder(therapist, cabinet, screenShare)}
            role="combobox" aria-label="Поиск" aria-autocomplete="list" aria-controls={CMD_LIST_ID}
            aria-expanded={rows.length > 0} aria-activedescendant={rows[sel] ? cmdOptionId(sel) : undefined}
          />
          {/* Телефон: бэкдропа не видно — «Отмена» закрывает палитру; на компьютере кнопка скрыта стилем. */}
          <button type="button" className="ds-link cmd-cancel" onClick={() => goBack()}>Отмена</button>
        </div>
        {/* «Показ экрана»: одна строка почему клиентов нет — без второй «Ничего не нашлось» под ней. */}
        <CmdList rows={rows} sel={sel} onSelect={setSel} onRun={run} searching={typed}
                 highlight={typed ? found.query : ''} fixedQuery={found.layoutFixed ? found.query.trim() : undefined}
                 help={paletteHelp({ therapist, therapistMode: cabinet, screenShare })}
                 examples={examples} onExample={(example) => { setQ(example); inputRef.current?.focus(); }}
                 note={screenShare && therapist ? 'Клиенты скрыты: включён показ экрана' : undefined} />
      </div>
    </div>
  );
}
