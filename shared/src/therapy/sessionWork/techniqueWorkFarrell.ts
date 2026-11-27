import type {
  FarrellShawTechniqueId,
  FarrellTechniqueId,
} from '../../schemaTherapy/guide/techniqueIds';
import type { TechniqueWorkDef } from './techniqueWork';

/** «Что делали»: техники из книги Фаррелл, Рейсс и Шоу о групповой схема-терапии. */
export const FARRELL_TECHNIQUE_WORK: Record<
  FarrellTechniqueId,
  TechniqueWorkDef
> = {
  mode_management_plan: {
    name: 'План управления режимами',
    fields: [
      ['mode', 'Режим'],
      ['now', 'Приёмы на сейчас'],
      ['later', 'Приёмы надолго'],
      ['schema', 'Связанная схема'],
    ],
  },
  healthy_adult_plan: {
    name: 'План Здорового Взрослого',
    fields: [
      ['scene', 'Режим и ситуация'],
      ['goodParent', 'Взгляд Хорошего Родителя'],
      ['plan', 'План и навыки'],
      ['result', 'Сработал ли план'],
    ],
  },
  safety_bubble: {
    name: 'Пузырь безопасности',
    fields: [
      ['image', 'Какой образ защиты'],
      ['effect', 'Что изменилось в теле и чувствах'],
      ['home', 'Как практиковать дома'],
    ],
  },
  story_unmet_need: {
    name: 'История о ребёнке и потребности',
    fields: [
      ['need', 'Что чувствовал ребёнок и что ему было нужно'],
      ['message', 'Какое послание он унёс, какие режимы'],
      ['goodParent', 'Ответ Хорошего Родителя'],
      ['own', 'Своё воспоминание клиента'],
    ],
  },
};

/** «Что делали»: техники из тетради Фаррелл и Шоу. */
export const FARRELL_SHAW_TECHNIQUE_WORK: Record<
  FarrellShawTechniqueId,
  TechniqueWorkDef
> = {
  monitoring_cycle: {
    name: 'Цикл самомониторинга',
    fields: [
      ['scene', 'Эпизод'],
      ['mode', 'Схема и режим'],
      ['need', 'Потребность'],
      ['result', 'Что сделано и итог'],
    ],
  },
  mode_awareness_summary: {
    name: 'Резюме осознания режима',
    fields: [
      ['mode', 'Режим'],
      ['signs', 'Ранние признаки'],
      ['roots', 'Схема и воспоминание'],
      ['need', 'Потребность и привычное действие'],
    ],
  },
  progress_by_mode: {
    name: 'Обзор прогресса по режимам',
    fields: [
      ['changed', 'Что изменилось'],
      ['ahead', 'Что впереди'],
      ['aims', 'Новые цели'],
    ],
  },
};
