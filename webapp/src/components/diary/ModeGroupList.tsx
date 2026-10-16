import { GlyphCheck } from '../exercises/ExScreen';
import { MODE_GROUPS } from '../../schemaTherapyData';
import { pressable } from '../../utils/a11y';
import { MODE_GROUP_HUE, hueStyle } from '../../lib/tone';
import '../../styles/sheet-diary.css';

/**
 * Полный список режимов по группам MODE_GROUPS — третичный путь для тех, кто
 * уже знает точное название режима. Вынесено из ModeSelectScreen, чтобы файл
 * не пробивал потолок (правило №10).
 */
export function ModeGroupList({
  modeId,
  onPick,
}: {
  modeId: string;
  onPick: (id: string) => void;
}) {
  return (
    <>
      {MODE_GROUPS.map((g) => (
        <div key={g.id} className="sd-group" style={hueStyle(MODE_GROUP_HUE[g.id])}>
          <div className="ds-label sd-group-label">
            <i className="ds-dot tone-fill" />
            {g.group}
          </div>
          {g.items.map((m) => (
            <div
              key={m.id}
              className={'ds-card ds-card--row ds-card--hover sd-mode-card' + (modeId === m.id ? ' is-selected' : '')}
              {...pressable(() => onPick(m.id))}
            >
              <div className="sd-mode-body">
                <div className="sd-mode-name">{m.name}</div>
                <div className="ds-sub">{m.short}</div>
              </div>
              <span className="sd-mode-check tone-text">
                <GlyphCheck />
              </span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
