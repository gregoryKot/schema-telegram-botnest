// Теги «Дневника одной страницей» — чипы со знаком типа записи (docs/design/APP_2026-11.md, b10a):
// мысль — Pebbles, схема — Layers, режим — Cluster, благодарность — Pebbles filled («спасибо по
// одному», решение 2: Leaf уже значит профиль и росток). Выбранный — бумага своей сущности
// (QUICK_TAG_ENTITY → ENTITY_LOOK) с галочкой на месте знака. Вид — общий чип ds-chip--toggle и
// слот знака pa-chip (SignChip, paper-app.css); свой файл, потому что это группа радиокнопок
// (role="radio", aria-checked — один тег на запись), а SignChip — переключатель (aria-pressed).
import type { CSSProperties } from 'react';
import { haptic } from '../../../haptic';
import { ENTITY_LOOK } from '../../../../../shared/src/theme/entityLook';
import { Pebbles } from '../../art/PaperArt';
import { SignArt } from '../../art/SignArt';
import { QUICK_TAGS, QUICK_TAG_ENTITY, type QuickTag } from './quickEntryModel';
import '../../../styles/paper-app.css';

function TagSign({ tag }: { tag: QuickTag }) {
  if (tag === 'gratitude') return <Pebbles size="nav" filled={1} />;
  return <SignArt sign={ENTITY_LOOK[QUICK_TAG_ENTITY[tag]].sign} size="nav" />;
}

export function QuickTagChips({ tag, onTag }: { tag: QuickTag; onTag: (t: QuickTag) => void }) {
  return (
    <div className="qe-tags" role="radiogroup" aria-label="Тег записи">
      {QUICK_TAGS.map((t) => {
        const on = tag === t.id;
        return (
          <button key={t.id} type="button" role="radio" aria-checked={on}
            className={'ds-chip ds-chip--toggle pa-chip pa-chip--mark qe-tag' + (on ? ' is-on' : '')}
            style={{ '--h': ENTITY_LOOK[QUICK_TAG_ENTITY[t.id]].hue } as CSSProperties}
            onClick={() => { haptic.select(); onTag(t.id); }}>
            <span className="pa-chip-sign" aria-hidden="true">
              {on ? <SignArt sign="check" size="nav" /> : <TagSign tag={t.id} />}
            </span>
            <span className="pa-chip-label">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
