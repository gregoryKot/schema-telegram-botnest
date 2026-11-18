// Список палитры ⌘K (CommandPalette.tsx): строки со знаком — язык знаков и здесь навигация, а не
// стрелка и молния у всех подряд (docs/design/APP_2026-11.md, «Меню, ⌘K»). Раздел — знак раздела
// (navLook.ts), быстрое действие — знак своей сущности (quickActionSign.ts), клиент —
// бледный кружок с инициалами, как в меню кабинета, переключение режима — Cluster («кто у руля»).
// Каждая строка — в группе с подписью ds-label (Клиенты, Разделы, Справочник, Действия; быстрые действия
// без запроса — группами реестра). Под полем — что ищется и примеры запросов; пусто — PaperEmpty с чашкой,
// та же подсказка и примеры. Сборка строк — commandPalette/paletteRows.ts. Палитра — ленивый чанк.
import type { SignKey } from '../../../shared/src/theme/entityLook';
import type { SearchResultKind } from '../../../shared/src/share/searchAnalytics';
import { SignArt } from './art/SignArt';
import { PaperEmpty } from './art/PaperEmpty';
import { pressable } from '../utils/a11y';
import { hueStyle } from '../lib/tone';

export type CmdMark = { sign: SignKey } | { initials: string; hue: number };
export interface CmdRow {
  /** Вид строки — для события открытия результата (search_result_open). */
  kind: SearchResultKind;
  /** Подпись группы над первой строкой группы. */
  group: string;
  label: string;
  sub?: string;
  hint?: string;
  mark: CmdMark;
  /** Текст, по которому ищется строка (подпись, подзаголовок и группа). */
  search: string;
  action: () => void;
  /** Приглушённая строка под этой («Ещё N — начни вводить имя»): не выбирается. */
  after?: string;
}

function Mark({ mark }: { mark: CmdMark }) {
  if ('sign' in mark) return <span className="cmd-mark" aria-hidden="true"><SignArt sign={mark.sign} size="row" /></span>;
  return (
    <span className="cmd-mark" aria-hidden="true">
      <span className="ds-avatar ds-avatar--paper cmd-avatar" style={hueStyle(mark.hue)}>{mark.initials}</span>
    </span>
  );
}

/** Примеры запросов чипами: тап подставляет запрос в поле. */
function Examples({ examples, onExample }: { examples: string[]; onExample: (query: string) => void }) {
  if (examples.length === 0) return null;
  return (
    <div className="cmd-examples">
      <span className="ds-sub">Например:</span>
      {examples.map((e) => (
        <button key={e} type="button" className="ds-chip ds-chip--toggle cmd-chip" onClick={() => onExample(e)}>{e}</button>
      ))}
    </div>
  );
}

export function CmdList({ rows, sel, onSelect, onRun, note, searching = false, help, examples = [], onExample }: {
  rows: CmdRow[];
  sel: number;
  onSelect: (i: number) => void;
  onRun: (row: CmdRow) => void;
  /** Пояснение над списком (клиенты скрыты показом экрана); с ним «Ничего не нашлось» не дублируется. */
  note?: string;
  /** Введён запрос: подсказка и примеры уходят из-под поля в пустое состояние. */
  searching?: boolean;
  /** Что ищется: «Клиенты, листы справочника, разделы и действия». */
  help?: string;
  examples?: string[];
  onExample?: (query: string) => void;
}) {
  const empty = rows.length === 0;
  const chips = onExample && (!searching || empty) && <Examples examples={examples} onExample={onExample} />;
  return (
    <div className="cmd-list">
      {!searching && help && <p className="ds-sub cmd-note">{help}</p>}
      {note && <p className="ds-sub cmd-note">{note}</p>}
      {empty && !note && <div className="cmd-empty"><PaperEmpty>Ничего не нашлось</PaperEmpty></div>}
      {empty && searching && help && <p className="ds-sub cmd-note">Здесь ищутся: {help.toLowerCase()}</p>}
      {chips}
      {rows.map((row, i) => (
        <div key={i} className="cmd-item">
          {row.group !== rows[i - 1]?.group && <p className="ds-label cmd-group">{row.group}</p>}
          <div
            className={`ds-list-row ds-list-row--hover cmd-row${i === sel ? ' is-sel' : ''}`}
            onMouseEnter={() => onSelect(i)}
            {...pressable(() => onRun(row))}
          >
            <Mark mark={row.mark} />
            <span className="cmd-main">
              <span className="cmd-label">{row.label}</span>
              {row.sub && <span className="ds-sub cmd-sub">{row.sub}</span>}
            </span>
            {row.hint && <span className={row.hint.startsWith('⌘') ? 'ds-kbd kbd-hint' : 'ds-sub cmd-hint'}>{row.hint}</span>}
          </div>
          {row.after && <p className="ds-sub cmd-after">{row.after}</p>}
        </div>
      ))}
    </div>
  );
}
