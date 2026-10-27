// Текст, который форма «Новое задание» сохраняет в задание, — общий для обоих
// фронтендов (правило №3: раньше сборка жила копией в каждом
// TaskCreateSheet). Текст хранится в БД и показывается клиенту и терапевту
// как есть, поэтому склонение решается здесь: до 2026-10-26 серия на три дня
// сохранялась как «Отмечать потребности 3 дней подряд» (QA-проход). Старые
// записи не переписываются — меняется только сборка новых.
import { pluralRu } from '../utils/pluralRu';

export interface TaskPayloadInput {
  type: string;
  targetDays: number;
  schemaId: string;
  modeId: string;
  /** «Своё задание»: текст терапевта или клиента. */
  text: string;
}

const days = (n: number) => `${n} ${pluralRu(n, 'день', 'дня', 'дней')}`;

export function taskPayloadText(p: TaskPayloadInput): string {
  switch (p.type) {
    case 'diary_streak':
      return `Заполнять дневник ${days(p.targetDays)} подряд`;
    case 'tracker_streak':
      return `Отмечать потребности ${days(p.targetDays)} подряд`;
    case 'schema_intro':
      return p.schemaId;
    case 'mode_intro':
      return p.modeId;
    case 'belief_check':
      return 'Проверить убеждение';
    case 'letter_to_self':
      return 'Написать письмо Уязвимому Ребёнку';
    case 'safe_place':
      return 'Описать Безопасное место';
    case 'flashcard':
      return 'Разобрать сложную ситуацию по шагам';
    default:
      return p.text;
  }
}
