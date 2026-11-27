import type { TechniqueId } from '../types';
import { narcissismCourseYoung } from './narcissismYoung';
/** Нарциссизм, досбор по Янгу (гл. 5): самонаблюдение и мотивация. */
export const narcissismCourseYoungAll: string[] = [
  ...narcissismCourseYoung,
  'Самоотчёту при нарциссическом поведении верят не целиком: такой клиент плохо видит своё поведение и его действие на людей. Картину дополняют встречей с партнёром или близкими и разбором примеров из истории отношений [Янг, гл. 5].',
  'Своё поведение расстраивает окружение больше, чем самого клиента, и мотивация появляется после резкого шага близкого — например, угрозы разрыва. Терапевт держит в фокусе долгосрочную цену [Янг, гл. 5].',
  'Чем удерживать мотивацию [Янг, гл. 5]: разбор «за и против», диалог здоровой стороны со стороной Привилегированности на стульях, карточка «отношения важнее», репетиция сдерживания гнева в образе.',
];

/** Техники статьи narcissism; pros_cons и flashcards — по гл. 5 Янга. */
export const NARCISSISM_TECHNIQUES: TechniqueId[] = [
  'limited_reparenting',
  'empathic_confrontation',
  'limit_setting',
  'mode_map',
  'imagery_rescripting',
  'chairwork',
  'pros_cons',
  'flashcards',
];
