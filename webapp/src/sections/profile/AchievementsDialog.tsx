import type { Achievement } from '../../api';
import { Dialog } from '../../components/Dialog';
import { AchievementTile } from './AchievementTile';
import { AchievementsShare } from './AchievementsShare';

interface Props {
  achievements: Achievement[];
  currentStreak: number;
  totalDays: number;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** Список достижений — лист бумаги страницы со сдвинутым слоем (cpf-paper-dlg), значки своих оттенков. */
export function AchievementsDialog({ achievements, currentStreak, totalDays, onSelect, onClose }: Props) {
  const earned = achievements.filter(a => a.earned).length;
  return (
    <Dialog label="Достижения" maxWidth={560} closeOnEscape onClose={onClose}>
      <div className="cpf-paper-dlg cpf-paper-dlg--list">
        <div className="ds-head-row cpf-dlg-head">
          <h2 className="dialog-title cpf-dlg-title">Достижения</h2>
          <span className="ds-sub cpf-dlg-count">{earned} из {achievements.length}</span>
          <AchievementsShare achievements={achievements} />
        </div>
        <div className="cpf-dlg-grid">
          {achievements.map(a => <AchievementTile key={a.id} achievement={a} currentStreak={currentStreak} totalDays={totalDays} onSelect={onSelect} />)}
        </div>
      </div>
    </Dialog>
  );
}
