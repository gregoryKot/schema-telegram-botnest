import { GlyphCheck } from '../exercises/ExScreen';
import { MODE_GROUPS } from '../../schemaTherapyData';
import { pressable } from '../../utils/a11y';

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
        <div key={g.id} style={{ marginBottom: 28 }}>
          <div className="chip-section-eyebrow" style={{ color: g.color }}>
            <span className="dot" style={{ background: g.color }} />
            {g.group}
          </div>
          {g.items.map((m) => (
            <div
              key={m.id}
              className={
                'mode-card ' + (modeId === m.id ? 'is-selected' : '')
              }
              style={{ '--mode-color': g.color } as React.CSSProperties}
              {...pressable(() => onPick(m.id))}
            >
              <span className="mode-card-stripe" />
              <div>
                <div className="mode-card-name">{m.name}</div>
                <div className="mode-card-short">{m.short}</div>
              </div>
              <span className="mode-check">
                <GlyphCheck />
              </span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
