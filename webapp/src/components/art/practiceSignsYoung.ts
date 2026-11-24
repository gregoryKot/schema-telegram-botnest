// Знаки разделов «Для терапевта» по книге Янга (пачка 8 карты; сверка — guideSignsModel.test.tsx).
// Готовых мотивов кабинета на всех не хватило, поэтому берутся знаки приложения с тем же смыслом:
// отложить метод — Pause («Стоп»), «ничего не вижу» — CopingAvoidance (лента огибает схему),
// резкое решение — CopingOvercompensation (рывок «назло схеме»), сценарии схем терапевта — Yield
// (терапевт прижался к чужому кругу), схема на сессии — Haven (о схеме говорят в безопасной рамке),
// когда к режимам — Looming (Критик навис, его называют «не мной»), шаги с режимами — Leaf (рост).
// Одно поведение — разные схемы — свой знак Roots (GuideSignsYoung.tsx).
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
};
