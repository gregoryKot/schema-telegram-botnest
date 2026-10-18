import type { Achievement } from '../../api';
import { pressable } from '../../utils/a11y';
import { ACHIEVEMENT_META } from './profileMeta';
import { achievementProgress } from './profileModel';

interface Props {
  achievement: Achievement;
  currentStreak: number;
  totalDays: number;
  onSelect: (id: string) => void;
}

/** Плитка достижения в диалоге: получено — открывает деталь, нет — прогресс или условие. */
export function AchievementTile({ achievement: a, currentStreak, totalDays, onSelect }: Props) {
  const m = ACHIEVEMENT_META[a.id];
  if (!m) return null;
  const progress = achievementProgress(a.id, a.earned, currentStreak, totalDays);
  return (
    <div {...pressable(() => a.earned && onSelect(a.id))}
      className={`cpf-ach cpf-ach--dlg${a.earned ? ' tone-tint is-earned' : ''}`}>
      <div className="cpf-ach-title">{m.title}</div>
      {progress ? <div className="cpf-ach-progress">{progress}</div> : <div className="cpf-ach-desc">{m.desc}</div>}
    </div>
  );
}
