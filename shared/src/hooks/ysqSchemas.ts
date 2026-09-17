// Реестры схем YSQ (потребностные группы, id для истории) + сборка/хуки
// формы обращения. Сам контент схем (20 штук: вопросы, цвет, описание,
// совет, потребность) — в ysqSchemasContent.ts (правило №10: этот файл
// пробивал потолок 300 строк с инлайн-контентом всех схем).
//
// `tip` — совет пользователю после прохождения теста, обращение зависит от
// addressForm (правило CLAUDE.md «ты/вы») — билдер от формы, как в
// shared/src/needs/needData.ts. `name`/`questions`/`color`/`desc`/`needId`
// от формы не зависят, поэтому `SCHEMAS` (ты-дефолт) остаётся статическим
// экспортом для потребителей, которым `tip` не нужен (скоринг, шаринг,
// сортировка) — им не нужно переходить на хук.
import { useAddressForm, type AddressForm } from '../utils/addressForm';
import { buildYsqSchemas } from './ysqSchemasContent';

export interface SchemaInfo {
  name: string;
  questions: number[]; // 1-indexed
  color: string;
  desc: string;
  tip: string;
  needId: string;
}

export type Tr = (ty: string, vy: string) => string;

export { buildYsqSchemas };

// Форма обращения не меняется в рамках сессии часто — кешируем по форме,
// чтобы не пересобирать массив на каждый рендер (как getNeedData в
// shared/src/needs/needData.ts).
const _schemaCache: Partial<Record<AddressForm, SchemaInfo[]>> = {};

export function getYsqSchemas(form: AddressForm): SchemaInfo[] {
  return (_schemaCache[form] ??= buildYsqSchemas((ty, vy) =>
    form === 'vy' ? vy : ty,
  ));
}

export function useYsqSchemas(): SchemaInfo[] {
  return getYsqSchemas(useAddressForm());
}

// Ты-дефолт для потребителей, которым `tip` не нужен (скоринг, сортировка,
// шаринг результата, история) — они не показывают tip пользователю, форма
// обращения им не важна, поэтому им не нужно переходить на хук. Потребители,
// рендерящие `tip` (YSQTestSheet.tsx, YsqActiveSchemaCard.tsx), берут
// разведённый по форме текст через useYsqSchemas().
export const SCHEMAS: SchemaInfo[] = getYsqSchemas('ty');

export const NEED_LABELS: Record<string, string> = {
  attachment: 'Привязанность',
  autonomy: 'Автономия',
  expression: 'Выражение',
  play: 'Игра/Радость',
  limits: 'Границы',
};

export const DOMAIN_ORDER = [
  'attachment',
  'autonomy',
  'expression',
  'play',
  'limits',
];

export function getSchemaForQuestion(qIdx: number): SchemaInfo | undefined {
  return SCHEMAS.find((s) => s.questions.includes(qIdx + 1));
}

// Соответствие названия схемы её id в истории (`YsqHistoryEntry.scores`),
// нужно только для дельты «изменилось с прошлого прохождения».
export const SCHEMA_NAME_TO_ID: Record<string, string> = {
  'Эмоциональная депривация': 'emotional_deprivation',
  'Покинутость/Нестабильность': 'abandonment',
  'Недоверие/Ожидание жестокого обращения': 'mistrust',
  'Социальная отчужденность': 'social_isolation',
  'Дефективность/Стыд': 'defectiveness',
  Неуспешность: 'failure',
  'Зависимость/Беспомощность': 'dependence',
  Уязвимость: 'vulnerability',
  'Спутанность/Неразвитая идентичность': 'enmeshment',
  Покорность: 'subjugation',
  Самопожертвование: 'self_sacrifice',
  'Страх потери контроля над эмоциями': 'emotion_inhibition_fear',
  'Эмоциональная скованность': 'emotional_inhibition',
  'Жёсткие стандарты/Придирчивость': 'unrelenting_standards',
  'Привилегированность/Грандиозность': 'entitlement',
  'Недостаточность самоконтроля': 'insufficient_self_control',
  'Поиск одобрения': 'approval_seeking',
  'Негативизм/Пессимизм': 'negativity',
  'Пунитивность (на себя)': 'punitiveness_self',
  'Пунитивность (на других)': 'punitiveness_others',
};
