import type { Achievement } from '../../api';
import { pressable } from '../../utils/a11y';
import { hueStyle } from '../../lib/tone';
import { ACHIEVEMENT_META, PROFILE_HUE } from './profileMeta';

interface Props { achievements: Achievement[]; onOpen: () => void }

export function AchievementsCard({ achievements, onOpen }: Props) {
  const earned = achievements.filter(a => a.earned).length;
  return (
    <section {...pressable(onOpen)} className="ds-card ds-card--hover cpf-card" style={hueStyle(PROFILE_HUE)}>
      <div className="ds-head-row">
        <h2 className="ds-h3">Достижения</h2>
        <span className="ds-sub">{earned} из {achievements.length} →</span>
      </div>
      {earned === 0 && <div className="ds-sub">Первое – за первую запись в дневник</div>}
      <div className="cpf-ach-grid">
        {achievements.map(a => {
          const m = ACHIEVEMENT_META[a.id];
          if (!m) return null;
          return (
            <div key={a.id} className={`cpf-ach${a.earned ? ' tone-tint' : ''}`}>
              <div className="cpf-ach-title">{m.title}</div>
              <div className="cpf-ach-desc">{m.desc}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
