import { MODE_GROUPS } from '../../schemaTherapyData';
import { hueStyle, MODE_GROUP_HUE } from '../../lib/tone';

interface Props {
  myModeIds: string[];
  onOpenMode: (id: string) => void;
  /** Внутри сворачиваемого «Все режимы» заголовок не нужен — он на кнопке. */
  hideTitle?: boolean;
}

/** «Карта режимов»: все режимы по группам, отмеченные пользователем подсвечены. */
export function ModeMap({ myModeIds, onOpenMode, hideTitle }: Props) {
  return (
    <section className="cs-block">
      {!hideTitle && <h3 className="ds-h3">Карта режимов</h3>}
      {MODE_GROUPS.map(group => (
        <div key={group.id} className="cs-domain" style={hueStyle(MODE_GROUP_HUE[group.id])}>
          <div className="cs-domain-head">
            <span className="cs-domain-line tone-fill" />
            <span className="cs-domain-name tone-ink">{group.group}</span>
          </div>
          <div className="cs-tiles cs-tiles--modes">
            {group.items.map(m => {
              const active = myModeIds.includes(m.id);
              return (
                <button key={m.id} className={`cs-tile${active ? ' is-mine tone-tint tone-border' : ''}`} onClick={() => onOpenMode(m.id)}>
                  <span className="cs-tile-name">{m.name}</span>
                  <span className="cs-tile-desc">{m.short}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </section>
  );
}
