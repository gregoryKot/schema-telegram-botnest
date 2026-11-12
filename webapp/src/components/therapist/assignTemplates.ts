import type { TaskType } from '../taskCreate/taskOptions';
import { exerciseCard } from '../../../../shared/src/exercises/exerciseCatalog';
import { ENTITY_LOOK, type Look } from '../../../../shared/src/theme/entityLook';

/** С чем открывается лист назначения: тип и, для «Своего задания», текст. */
export interface AssignPreset { type: TaskType; text?: string }

/** `look` — бумага и знак плитки: сущность, которую клиент получит заданием (ENTITY_LOOK; тот же знак, что TaskSign у клиента). */
interface AssignTemplate { title: string; sub: string; preset: AssignPreset; look: Look }

const look = (id: keyof typeof ENTITY_LOOK): Look => ({ hue: ENTITY_LOOK[id].hue, sign: ENTITY_LOOK[id].sign });

// «Назначить из шаблона» во вкладке «Задания». До 2026-10-26 все четыре
// карточки открывали лист с «Трекером потребностей», а «Imagery rescripting»
// («аудио-практика, 12 минут») и «Дневник режима» обещали то, чего в
// назначении нет (QA-проход). Теперь каждый шаблон открывает свой тип;
// «Дневник режима» — «Своё задание» с заготовкой текста (отдельного типа нет),
// аудио-практики в приложении нет — вместо неё «Безопасное место», работа с
// образом, которая в приложении есть. Плитки — бумага сущности со знаком (b31, принцип 3), а не
// «конфетные» заливки: схема 28 Layers, дневник режима 240 Cluster, письмо 290 Sheets, безопасное место 135 Haven.
export const ASSIGN_TEMPLATES: AssignTemplate[] = [
  { title: 'Схема-карточка', sub: 'Триггеры · чувства · мысли · корни · реальность · поведение', preset: { type: 'schema_intro' }, look: look('schema_card') },
  {
    title: 'Дневник режима',
    sub: '5–7 эпизодов, фокус на конкретном режиме',
    preset: { type: 'custom', text: 'Дневник режима: записать 5–7 эпизодов, когда включается режим ' },
    look: look('diary_mode'),
  },
  { title: exerciseCard('letter').title, sub: 'От Здорового Взрослого к Уязвимому Ребёнку', preset: { type: 'letter_to_self' }, look: look('letter') },
  { title: 'Безопасное место', sub: 'Описать образ и возвращаться к нему', preset: { type: 'safe_place' }, look: look('safe_place') },
];
