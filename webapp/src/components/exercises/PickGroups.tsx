import { haptic } from '../../haptic';
import { GlyphCheck } from './ExGlyphs';
import { pressable } from '../../utils/a11y';
import { SignArt } from '../art/SignArt';
import type { SheetLook } from '../../../../shared/src/theme/entityLook';
import { hueStyle } from '../../lib/tone';
import { glue } from '../../../../shared/src/utils/typo';
import '../../styles/sheet-diary.css';

export interface PickGroup {
  id: string;
  label: string;
  /** Бумага и знак группы: группа режимов (modeGroupLook) или домен схем (domainLook). */
  look: SheetLook;
  items: { id: string; name: string; desc: string }[];
}

/** Выбор одного из длинного списка по группам — одна механика на дневник режимов («другие режимы»
 *  разбора, мастер из ⌘K — ModeGroupList) и карточки схем и режимов (FlashcardEx). Группа — бумага
 *  своего оттенка со знаком у подписи (как «Справочник» терапевта, APP_2026-11.md, принцип 10),
 *  строки — белый список без точек, выбранная — бумага группы с галочкой. Две колонки — когда шире
 *  700 сам список (container sd-groups, diary-mode.css), а не окно. `clamp` — длинные описания
 *  (схемы) в две строки с многоточием: список из 18 схем на телефоне иначе шёл на 3000px. */
export function PickGroups({ groups, selectedId, onPick, clamp }: {
  groups: PickGroup[]; selectedId?: string; onPick: (id: string) => void; clamp?: boolean;
}) {
  return (
    <div className="sd-groups-box"><div className={'sd-groups' + (clamp ? ' is-clamped' : '')}>
      {groups.map((g) => (
        <section key={g.id} className="pp-paper sd-group-block" style={hueStyle(g.look.hue)}>
          <h3 className="sd-group-head">
            {g.look.sign && <span className="sd-group-sign" aria-hidden="true"><SignArt sign={g.look.sign} size="square" /></span>}
            <span className="ds-label sd-group-name">{g.label}</span>
          </h3>
          <div className="sd-group-rows">
            {g.items.map((it) => (
              <div key={it.id} className={'sd-mode-card' + (selectedId === it.id ? ' is-selected' : '')}
                {...pressable(() => { haptic.select(); onPick(it.id); })}>
                <div className="sd-mode-body">
                  <div className="sd-mode-name">{it.name}</div>
                  <div className="sd-mode-short">{glue(it.desc)}</div>
                </div>
                <span className="sd-mode-check" aria-hidden="true"><GlyphCheck /></span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div></div>
  );
}
