import { useState, useEffect, useMemo, useRef, type CSSProperties } from 'react';
import { useTr } from '../utils/addressForm';
import type { QuickActionId } from '../../../shared/src/quickActions/quickActions';
import type { UserId } from '../api';
import { CmdList, type CmdRow } from './CommandPaletteList';
import { CMD_LIST_ID, cmdOptionId } from './commandPalette/listIds';
import { searchPalette } from './commandPalette/paletteRows';
import { readRecent } from './commandPalette/paletteRecent';
import { paletteExamples, paletteHelp, palettePlaceholder } from './commandPalette/paletteTexts';
import { runPaletteRow, usePaletteActions } from './commandPalette/usePaletteActions';
import { usePaletteClientData } from './commandPalette/usePaletteClientData';
import { usePaletteGuide } from './commandPalette/usePaletteGuide';
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
 * Общий поиск ⌘K: клиенты и вкладки их карточек, разделы, листы «Справочника», задания (кабинет терапевта),
 * в режиме клиента — схемы, режимы, упражнения, свои планы и задания, действия; у всех — настройки и статьи. Строки собирает commandPalette/paletteRows.ts, действия строк и второй шаг «Кому дать
 * задание?» — usePaletteActions.ts: событие search_result_open без текста запроса и ключ строки в
 * «Недавнее» (paletteRecent.ts). На телефоне панель — во весь видимый экран над клавиатурой.
 */
/** Высота и сдвиг видимой области — переменными для телефонной раскладки (command-palette.css). */
function viewportVars(viewport: { height: number; offsetTop: number } | null): CSSProperties | undefined {
  if (!viewport) return undefined;
  return { '--cmd-vvh': `${viewport.height}px`, '--cmd-vvt': `${viewport.offsetTop}px` } as CSSProperties;
}

export function CommandPalette({ onNavigate, onClose, userRole, therapistMode, onToggleMode, onOpenClient, onQuickAction }: Props) {
  const tr = useTr();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
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

  const therapist = userRole === 'THERAPIST';
  const cabinet = therapist && !!therapistMode;
  const { clients, own, articles } = usePaletteClientData(therapist, cabinet);
  const guide = usePaletteGuide(cabinet, tr);
  const { assign, run: actions, leaveAssign } = usePaletteActions({ onNavigate, onOpenClient, onToggleMode, onQuickAction, clients, guide, setQuery: setQ, inputRef });
  const mode = { therapist, therapistMode: cabinet, screenShare };
  const found = useMemo(
    () => searchPalette({ query: q, tr, therapist, therapistMode: !!therapistMode, screenShare, clients, own, articles, guide, recent, assign, run: actions }),
    [q, tr, therapist, therapistMode, screenShare, clients, own, articles, guide, recent, assign, actions],
  );
  const rows = found.rows;
  const examples = useMemo(() => paletteExamples(guide, cabinet), [guide, cabinet]);
  const typed = q.trim() !== '';
  const run = (row: CmdRow | undefined) => runPaletteRow(row, typed, goBack);
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
      if (e.key === 'Backspace' && assign && q === '') leaveAssign(); // пустое поле второго шага — назад к поиску
    }
    // На перехвате: панель гасит всплытие Enter (чтобы не закрыть бэкдроп), до window на всплытии он не доходит.
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [rows, sel, typed, assign, q, leaveAssign]);

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
            placeholder={palettePlaceholder(mode, !!assign)}
            role="combobox" aria-label="Поиск" aria-autocomplete="list" aria-controls={CMD_LIST_ID}
            aria-expanded={rows.length > 0} aria-activedescendant={rows[sel] ? cmdOptionId(sel) : undefined}
          />
          {/* Телефон: бэкдропа не видно — «Отмена» закрывает палитру; на компьютере кнопка скрыта стилем. */}
          <button type="button" className="ds-link cmd-cancel" onClick={() => (assign ? leaveAssign() : goBack())}>{assign ? 'Назад' : 'Отмена'}</button>
        </div>
        {/* «Показ экрана»: одна строка почему клиентов нет — без второй «Ничего не нашлось» под ней. */}
        {assign
          ? <CmdList rows={rows} sel={sel} onSelect={setSel} onRun={run} searching={typed} highlight={typed ? found.query : ''}
                     help={typed ? undefined : 'Откроется лист нового задания в карточке клиента'}
                     emptyText="Клиент с таким именем не нашёлся" />
          : <CmdList rows={rows} sel={sel} onSelect={setSel} onRun={run} searching={typed}
                     highlight={typed ? found.query : ''} fixedQuery={found.layoutFixed ? found.query.trim() : undefined}
                     help={paletteHelp(mode)}
                     examples={examples} onExample={(example) => { setQ(example); inputRef.current?.focus(); }}
                     note={screenShare && therapist ? 'Клиенты скрыты: включён показ экрана' : undefined} />}
      </div>
    </div>
  );
}
