import type { Achievement } from '../../api';
import { pressable } from '../../utils/a11y';
import { ACHIEVEMENT_META } from './profileMeta';
import { achievementProgress } from './profileModel';
import { AchievementBadge } from './AchievementBadge';

interface Props {
  achievement: Achievement;
  currentStreak: number;
  totalDays: number;
  onSelect: (id: string) => void;
}

/** Плитка достижения в диалоге: значок по ACHIEVEMENT_LOOK; получено — открывает деталь, нет — силуэт
 *  и прогресс или условие. Имя кнопки начинается с названия (значок — декор). */
export function AchievementTile({ achievement: a, currentStreak, totalDays, onSelect }: Props) {
  const m = ACHIEVEMENT_META[a.id];
  if (!m) return null;
  const progress = achievementProgress(a.id, a.earned, currentStreak, totalDays);
  return (
    <div {...pressable(() => a.earned && onSelect(a.id))}
      className={`cpf-ach cpf-ach--dlg${a.earned ? ' is-earned' : ''}`}>
      <AchievementBadge id={a.id} earned={a.earned} />
      <span className="cpf-ach-text">
        <span className="cpf-ach-title">{m.title}</span>
        {progress ? <span className="cpf-ach-progress">{progress}</span> : <span className="cpf-ach-desc">{m.desc}</span>}
      </span>
    </div>
  );
}
