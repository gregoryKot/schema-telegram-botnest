import type { Achievement } from '../../api';
import { Dialog } from '../../components/Dialog';
import { useHistorySheet } from '../../hooks/useHistorySheet';
import { AchievementTile } from './AchievementTile';
import { AchievementsShare } from './AchievementsShare';

interface Props {
  achievements: Achievement[];
  currentStreak: number;
  totalDays: number;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** Список достижений — лист бумаги страницы со сдвинутым слоем (cpf-paper-dlg), значки своих оттенков.
 *  Запись в истории: «Назад» браузера закрывает список; выбор значка — goBack(then): список уступает место детали. */
export function AchievementsDialog({ achievements, currentStreak, totalDays, onSelect, onClose }: Props) {
  const goBack = useHistorySheet(onClose);
  const select = (id: string) => goBack(() => onSelect(id));
  const earned = achievements.filter(a => a.earned).length;
  return (
    <Dialog label="Достижения" maxWidth={680} closeOnEscape onClose={goBack}>
      <div className="cpf-paper-dlg cpf-paper-dlg--list">
        <div className="ds-head-row cpf-dlg-head">
          <h2 className="dialog-title cpf-dlg-title">Достижения</h2>
          <span className="ds-sub cpf-dlg-count">{earned} из {achievements.length}</span>
          <AchievementsShare achievements={achievements} />
        </div>
        <div className="cpf-dlg-grid">
          {achievements.map(a => <AchievementTile key={a.id} achievement={a} currentStreak={currentStreak} totalDays={totalDays} onSelect={select} />)}
        </div>
      </div>
    </Dialog>
  );
}
