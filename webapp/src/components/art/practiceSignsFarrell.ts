// Знаки разделов «Для терапевта» по Фарреллу (групповая схема-терапия): подготовка к группе —
// «здоровая семья», принадлежность — знак потребности в привязанности; план против режима группы — «настройка» (Attune);
// ролевая игра режимов — Talk, как стулья: режимы говорят голосами.
import type { GuideSign } from './guideSignsModel';

export const FARRELL_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  group_orientation: 'need_attachment',
  group_plan_vs_mode: 'attune',
  group_mode_roleplay: 'talk',
};
