import { haptic } from '../../haptic';
import { GlyphCheck } from '../exercises/ExScreen';
import { MODE_GROUPS } from '../../schemaTherapyData';
import { pressable } from '../../utils/a11y';
import { SignArt } from '../art/SignArt';
import { modeGroupLook } from '../../../../shared/src/theme/entityLook';
import { hueStyle } from '../../lib/tone';
import '../../styles/sheet-diary.css';

/**
 * Полный список режимов по группам — для тех, кто знает название (дневник режимов, «другие режимы»
 * разбора, мастер из ⌘K). Группа — бумага MODE_GROUP_HUE со знаком группы (как в «Справочнике»
 * терапевта), строки — белый список без точек, выбранная — бумага группы с галочкой. Две колонки —
 * когда шире 700 сам список (container sd-groups, diary-mode.css), а не окно: в развороте колонка уже.
 */
export function ModeGroupList({ modeId, onPick }: { modeId: string; onPick: (id: string) => void }) {
  return (
    <div className="sd-groups-box"><div className="sd-groups">
      {MODE_GROUPS.map((g) => {
        const look = modeGroupLook(g.id);
        return (
          <section key={g.id} className="pp-paper sd-group-block" style={hueStyle(look.hue)}>
            <h3 className="sd-group-head">
              <span className="sd-group-sign" aria-hidden="true"><SignArt sign={look.sign} size="square" /></span>
              <span className="ds-label sd-group-name">{g.group}</span>
            </h3>
            <div className="sd-group-rows">
              {g.items.map((m) => (
                <div key={m.id} className={'sd-mode-card' + (modeId === m.id ? ' is-selected' : '')}
                  {...pressable(() => { haptic.select(); onPick(m.id); })}>
                  <div className="sd-mode-body">
                    <div className="sd-mode-name">{m.name}</div>
                    <div className="sd-mode-short">{m.short}</div>
                  </div>
                  <span className="sd-mode-check" aria-hidden="true"><GlyphCheck /></span>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div></div>
  );
}
