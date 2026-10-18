import { MODE_GROUPS, ALL_MODES } from '../../schemaTherapyData';
import { useTr } from '../../utils/addressForm';
import { hueStyle, MODE_GROUP_HUE } from '../../lib/tone';
import { FreqMark, FreqHint } from './FreqMark';
import { Skeleton } from '../../components/Skeleton';

interface Props {
  loading: boolean; myModeIds: string[]; onAdd: () => void;
  onOpenMode: (id: string) => void;
  modeFreq?: Record<string, number>; // дней за неделю по дневнику; undefined — пока не загрузилось
  onOpenPattern: (id: string) => void; // чип «Мои режимы» → экран паттерна; плитки карты → onOpenMode
}

const MODE_HUE: Record<string, number | undefined> = Object.fromEntries(
  MODE_GROUPS.flatMap(g => g.items.map(m => [m.id, MODE_GROUP_HUE[g.id]])),
);

/** «Мои режимы» (чипы) и «Карта режимов» (все режимы по группам). */
export function ModesBlocks({ loading, myModeIds, onAdd, onOpenMode, onOpenPattern, modeFreq }: Props) {
  const tr = useTr();
  const myModes = myModeIds.map(id => ALL_MODES.find(m => m.id === id)).filter(Boolean) as typeof ALL_MODES;
  return (
    <>
      <section className="cs-block">
        <div className="ds-head-row">
          <h3 className="ds-h3">Мои режимы</h3>
          <button onClick={onAdd} className="ds-link">+ Добавить</button>
        </div>
        {loading ? (
          <div className="cs-chips">
            {[90, 110, 80].map((w, i) => <Skeleton key={i} height={32} width={w} radius={16} />)}
          </div>
        ) : myModes.length === 0 ? (
          <p className="cs-empty">{tr('Добавь режимы которые узнаёшь у себя', 'Добавьте режимы которые узнаёте у себя')}</p>
        ) : (
          <>
          {modeFreq && <FreqHint kind="mode" freq={modeFreq} />}
          <div className="cs-chips">
            {myModes.map(m => (
              <button key={m.id} className={`cs-chip tone-tint tone-border${modeFreq?.[m.id] ? ' cs-chip--stacked' : ''}`} style={hueStyle(MODE_HUE[m.id])} onClick={() => onOpenPattern(m.id)}>
                <i className="ds-dot tone-fill" />
                {m.name}
                {modeFreq && <FreqMark freq={modeFreq[m.id] ?? 0} />}
              </button>
            ))}
          </div>
          </>
        )}
      </section>

      <section className="cs-block">
        <h3 className="ds-h3">Карта режимов</h3>
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
    </>
  );
}
