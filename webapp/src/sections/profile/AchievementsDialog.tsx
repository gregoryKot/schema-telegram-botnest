import type { Achievement } from '../../api';
import { Dialog } from '../../components/Dialog';
import { pressable } from '../../utils/a11y';
import { hueStyle } from '../../lib/tone';
import { ACHIEVEMENT_META, PROFILE_HUE } from './profileMeta';
import { achievementProgress } from './profileModel';

interface Props {
  achievements: Achievement[];
  currentStreak: number;
  totalDays: number;
  onSelect: (id: string) => void;
  onClose: () => void;
}

export function AchievementsDialog({ achievements, currentStreak, totalDays, onSelect, onClose }: Props) {
  const earned = achievements.filter(a => a.earned).length;
  return (
    <Dialog label="Достижения" maxWidth={520} closeOnEscape onClose={onClose}>
      <div className="ds-head-row cpf-dlg-head">
        <h2 className="dialog-title cpf-dlg-title">Достижения</h2>
        <span className="ds-sub">{earned} из {achievements.length}</span>
      </div>
      <div className="cpf-dlg-grid" style={hueStyle(PROFILE_HUE)}>
        {achievements.map(a => {
          const m = ACHIEVEMENT_META[a.id];
          if (!m) return null;
          const progress = achievementProgress(a.id, a.earned, currentStreak, totalDays);
          return (
            <div key={a.id} {...pressable(() => a.earned && onSelect(a.id))}
              className={`cpf-ach cpf-ach--dlg${a.earned ? ' tone-tint is-earned' : ''}`}>
              <div className="cpf-ach-title">{m.title}</div>
              {progress ? <div className="cpf-ach-progress">{progress}</div> : <div className="cpf-ach-desc">{m.desc}</div>}
            </div>
          );
        })}
      </div>
    </Dialog>
  );
}
