// Знаки «Для терапевта» по Фаррелл–Шоу (самопрактика): зачем — тропа с вехами («Обзор» пути); безопасность — узел
// на ленте (застрять и остановиться); форматы — рамка из трёх частей; рефлексия — ступени; обзор — флажки-вехи прогресса;
// день самопрактики в группе — линия времени (упражнения дня по порядку); Критик терапевта — внутренний голос;
// трудный клиент и мой копинг — «за и против»; свой Здоровый Взрослый — фигуры частей; Счастливый Ребёнок — копилка
// радостей; вечерний обход — план на режим; цикл самомониторинга — круг; анализ проблемы — проба; план на себе — шаг.
// Метод (гл. 2): стиль родительства — место рядом; два уровня опыта — линза; кому подходит — подход; культура — россыпь.
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
  know_your_healthy_adult: 'figures',
  therapist_happy_child: 'keepsake',
  therapist_modes_walk: 'mode_plan',
  self_monitoring_cycle: 'pie',
  problem_analysis_modes: 'probe',
  self_mode_management_plan: 'try_step',
  limited_reparenting_style: 'side_seat',
  two_levels_of_experience: 'schema_lens',
  schema_therapy_fit: 'approach',
  culture_and_needs: 'scatter',
};
