// Знаки «Для терапевта» по Фаррелл–Шоу (самопрактика): зачем — тропа с вехами («Обзор» пути); безопасность — узел
// на ленте (застрять и остановиться); форматы — рамка из трёх частей; рефлексия — ступени; обзор — флажки-вехи прогресса;
// день самопрактики в группе — линия времени (упражнения дня по порядку); Критик терапевта — внутренний голос;
// трудный клиент и мой копинг — «за и против»; цикл самомониторинга — круг; анализ проблемы — проба;
// план на себе — пробный шаг.
import type { GuideSign } from './guideSignsModel';

export const FARRELL_SHAW_PRACTICE_NOTE_SIGN: Record<string, GuideSign> = {
  self_practice_why: 'path_overview',
  self_practice_safety: 'path_stuck',
  self_practice_formats: 'path_session',
  self_practice_reflection: 'path_mode_order',
  self_practice_review: 'path_progress',
  self_practice_group_day: 'path_timeline',
  therapist_critic: 'talk_inner',
  difficult_client_my_coping: 'ambivalence',
  self_monitoring_cycle: 'pie',
  problem_analysis_modes: 'probe',
  self_mode_management_plan: 'try_step',
};
