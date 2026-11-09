// «Эта неделя» справа от ленты «Записей» на широком экране (b11): лист бумаги дневника, строки —
// знак типа, ярлык и число за семь местных дней. Только реальные данные (dayModel.weekRows): нет
// записей за неделю или неделя ещё не загружена целиком — листа нет. На телефоне и планшете
// колонки нет (client-diary.css): лента там во всю ширину.
import { ENTITY_LOOK } from '../../../../shared/src/theme/entityLook';
import { hueStyle } from '../../lib/tone';
import { ENTRY_KIND_LABEL } from './entryKind';
import { FeedSign } from './EntryKindChip';
import { kindLook } from './feedLook';
import type { WeekRow } from './dayModel';

export function WeekSummary({ rows }: { rows: WeekRow[] }) {
  if (rows.length === 0) return null;
  return (
    <aside className="pp-paper cd-week" style={hueStyle(ENTITY_LOOK.diary.hue)} aria-labelledby="cd-week-title">
      <span className="ds-label" id="cd-week-title">Эта неделя</span>
      <ul className="cd-week-rows">
        {rows.map(({ kind, count }) => (
          <li key={kind} className="cd-week-row">
            <FeedSign look={kindLook(kind)} />
            <span className="cd-week-name">{ENTRY_KIND_LABEL[kind]}</span>
            <b className="cd-week-n">{count}</b>
          </li>
        ))}
      </ul>
    </aside>
  );
}
