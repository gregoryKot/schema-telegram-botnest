// Знаки разделов «Для терапевта» по Янгу: готовых мотивов не хватило, взяты знаки приложения с тем же смыслом.
// Сверка — guideSignsModel.test.tsx; знак «Одно поведение — разные схемы» (Roots) рисует GuideSignsYoung.tsx.
import type { GuideSign } from './guideSignsModel';

export const YOUNG_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  suitability: 'pause',
  imagery_avoidance: 'coping_avoidance',
  life_decisions: 'coping_overcompensation',
  therapist_schema_scenarios: 'yield',
  schemas_in_session: 'haven',
  mode_work_when: 'looming',
  mode_work_steps: 'leaf',
  same_behavior_by_schema: 'roots',
  schema_channel_map: 'levels_heart',
};
