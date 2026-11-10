// Теги «Дневника одной страницей» — чипы со знаком типа записи (docs/design/APP_2026-11.md, b10a):
// мысль — Pebbles, схема — Layers, режим — Cluster, благодарность — Pebbles filled («спасибо по
// одному», решение 2: Leaf уже значит профиль и росток). Выбранный — бумага своей сущности
// (QUICK_TAG_ENTITY → ENTITY_LOOK) с галочкой на месте знака. Чип — общий SignChip в роли радиокнопки
// (role="radio", aria-checked — один тег на запись), рисунок благодарности — его проп art.
import { haptic } from '../../../haptic';
import { ENTITY_LOOK } from '../../../../../shared/src/theme/entityLook';
import { Pebbles } from '../../art/PaperArt';
import { SignChip } from '../../paper/SignChip';
import { QUICK_TAGS, QUICK_TAG_ENTITY, type QuickTag } from './quickEntryModel';

export function QuickTagChips({ tag, onTag }: { tag: QuickTag; onTag: (t: QuickTag) => void }) {
  return (
    <div className="qe-tags" role="radiogroup" aria-label="Тег записи">
      {QUICK_TAGS.map((t) => {
        const look = ENTITY_LOOK[QUICK_TAG_ENTITY[t.id]];
        return (
          <SignChip key={t.id} label={t.label} on={tag === t.id} radio hue={look.hue} sign={look.sign} className="qe-tag"
            art={t.id === 'gratitude' ? <Pebbles size="nav" filled={1} /> : undefined}
            onToggle={() => { haptic.select(); onTag(t.id); }} />
        );
      })}
    </div>
  );
}
