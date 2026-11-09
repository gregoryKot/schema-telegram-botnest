// Список палитры ⌘K (CommandPalette.tsx): строки со знаком — язык знаков и здесь навигация, а не
// стрелка и молния у всех подряд (docs/design/APP_2026-11.md, «Меню, ⌘K»). Раздел — знак раздела
// (navLook.ts), быстрое действие — знак своей сущности (quickActionSign.ts), клиент —
// бледный кружок с инициалами, как в меню кабинета, переключение режима — Cluster («кто у руля»).
// Быстрые действия идут группами реестра (Разобраться, Записать момент…) с подписью ds-label.
// Пусто — PaperEmpty с чашкой. Палитра — ленивый чанк.
import type { SignKey } from '../../../shared/src/theme/entityLook';
import { SignArt } from './art/SignArt';
import { PaperEmpty } from './art/PaperEmpty';
import { pressable } from '../utils/a11y';
import { hueStyle } from '../lib/tone';

export type CmdMark = { sign: SignKey } | { initials: string; hue: number };
export interface CmdRow {
  /** Подпись группы над первой строкой группы (быстрые действия); у разделов и клиентов — нет. */
  group?: string;
  label: string;
  sub?: string;
  activeToday?: boolean;
  hint?: string;
  mark: CmdMark;
  /** Текст, по которому ищется строка (подпись, подзаголовок и группа). */
  search: string;
  action: () => void;
}

function Mark({ mark }: { mark: CmdMark }) {
  if ('sign' in mark) return <span className="cmd-mark" aria-hidden="true"><SignArt sign={mark.sign} size="row" /></span>;
  return (
    <span className="cmd-mark" aria-hidden="true">
      <span className="ds-avatar cmd-avatar" style={hueStyle(mark.hue)}>{mark.initials}</span>
    </span>
  );
}

export function CmdList({ rows, sel, onSelect, onRun, note }: {
  rows: CmdRow[];
  sel: number;
  onSelect: (i: number) => void;
  onRun: (row: CmdRow) => void;
  /** Строка над списком вместо «ничего не найдено» (клиенты скрыты показом экрана). */
  note?: string;
}) {
  return (
    <div className="cmd-list">
      {note && <p className="ds-sub cmd-note">{note}</p>}
      {rows.length === 0 && !note && <div className="cmd-empty"><PaperEmpty>Ничего не найдено</PaperEmpty></div>}
      {rows.map((row, i) => (
        <div key={i} className="cmd-item">
          {row.group && row.group !== rows[i - 1]?.group && <p className="ds-label cmd-group">{row.group}</p>}
          <div
            className={`ds-list-row ds-list-row--hover cmd-row${i === sel ? ' is-sel' : ''}`}
            onMouseEnter={() => onSelect(i)}
            {...pressable(() => onRun(row))}
          >
            <Mark mark={row.mark} />
            <span className="cmd-main">
              <span className="cmd-label">{row.label}</span>
              {row.sub && <span className={'ds-sub cmd-sub' + (row.activeToday ? ' is-ok' : '')}>{row.sub}</span>}
            </span>
            {row.hint && <span className={row.hint.startsWith('⌘') ? 'ds-kbd kbd-hint' : 'ds-sub cmd-hint'}>{row.hint}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
