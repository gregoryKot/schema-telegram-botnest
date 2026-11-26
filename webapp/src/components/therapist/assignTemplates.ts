import type { TaskAssignOrigin } from '../../../../shared/src/share/taskAssignAnalytics';
import type { TaskType } from '../taskCreate/taskOptions';
import { exerciseCard } from '../../../../shared/src/exercises/exerciseCatalog';
import { ENTITY_LOOK, type EntityId, type Look } from '../../../../shared/src/theme/entityLook';
import { taskEntity } from '../../sections/practice/taskEntity';

/** С чем открывается лист назначения: тип и, для «Своего задания», текст; catalogId — запись справочника заданий; origin — откуда заготовка (аналитика). */
export interface AssignPreset { type: TaskType; text?: string; catalogId?: string; origin?: TaskAssignOrigin }

/** `look` — бумага и знак плитки: сущность задания шаблона (`taskEntity`, как у TaskSign строки и доски); `entity` задаёт её явно. */
interface AssignTemplate { title: string; sub: string; preset: AssignPreset; look: Look }
const tpl = (title: string, sub: string, base: AssignPreset, entity?: EntityId): AssignTemplate => {
  const preset: AssignPreset = { ...base, origin: 'template' };
  const { hue, sign } = ENTITY_LOOK[entity ?? taskEntity({ type: preset.type, text: preset.text ?? '' })];
  return { title, sub, preset, look: { hue, sign } };
};

// «Назначить из шаблона» во вкладке «Задания». До 2026-10-26 все четыре
// карточки открывали лист с «Трекером потребностей», а «Imagery rescripting»
// («аудио-практика, 12 минут») и «Дневник режима» обещали то, чего в
// назначении нет (QA-проход). Теперь каждый шаблон открывает свой тип;
// «Дневник режима» — «Своё задание» с заготовкой текста (отдельного типа нет),
// аудио-практики в приложении нет — вместо неё «Безопасное место», работа с
// образом, которая в приложении есть. Плитки — бумага сущности со знаком (b31): схема 28 Layers, письмо 290 Sheets,
// безопасное место 135 Haven, «Дневник режима» — знак режимов Cluster 240: галочка «Своего задания» на плитке читалась как «выполнено».
export const ASSIGN_TEMPLATES: AssignTemplate[] = [
  tpl('Схема-карточка', 'Триггеры · чувства · мысли · корни · реальность · поведение', { type: 'schema_intro' }),
  tpl('Дневник режима', '5–7 эпизодов, фокус на конкретном режиме', { type: 'custom', text: 'Дневник режима: записать 5–7 эпизодов, когда включается режим ' }, 'diary_mode'),
  tpl(exerciseCard('letter').title, 'От Здорового Взрослого к Уязвимому Ребёнку', { type: 'letter_to_self' }),
  tpl('Безопасное место', 'Описать образ и возвращаться к нему', { type: 'safe_place' }),
];
