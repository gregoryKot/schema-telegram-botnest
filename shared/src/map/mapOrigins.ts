/**
 * Полоса «Откуда тянется» карты себя — схемы человека: активные по последнему
 * тесту (YSQ) и отмеченные вручную в «Моих паттернах». Схема здесь — корень, из
 * которого включаются части выше; связь «эта схема → этот режим» карта не
 * выдумывает (.claude/rules/theory.md): строка ведёт в карточку схемы.
 *
 * Схем нет — честная строка без обещаний: тест не пройден → вход в тест;
 * пройден, но ярких схем не нашлось → отметить свои в «Моих паттернах».
 */
import { getSchemaById } from '../schemaTherapy/schemaTherapyData';

export interface OriginsInput {
  /** Активные схемы последнего теста (`profile.ysq.activeSchemaIds`). */
  ysqSchemaIds: string[];
  /** Выбранные вручную (`mySchemaIds`). */
  manualSchemaIds: string[];
  ysqDone: boolean;
}

export interface OriginSchemaItem {
  schemaId: string;
  name: string;
  fromTest: boolean;
}

export interface OriginsView {
  title: string;
  items: OriginSchemaItem[];
  /** Чем заменить пустой список: вход в тест или в «Мои паттерны». */
  empty: 'test' | 'pick' | null;
}

export const ORIGINS_TITLE = 'Откуда тянется';

/** Схемы без повторов, сначала по тесту; неизвестный id пропускается. */
export function buildOrigins(input: OriginsInput): OriginsView {
  const fromTest = new Set(input.ysqSchemaIds);
  const items: OriginSchemaItem[] = [];
  for (const id of new Set([...input.ysqSchemaIds, ...input.manualSchemaIds])) {
    const schema = getSchemaById(id);
    if (schema)
      items.push({
        schemaId: id,
        name: schema.name,
        fromTest: fromTest.has(id),
      });
  }
  const empty = items.length > 0 ? null : input.ysqDone ? 'pick' : 'test';
  return { title: ORIGINS_TITLE, items, empty };
}

/** Подпись строки схемы: откуда она на карте. */
export const originSub = (item: OriginSchemaItem): string =>
  item.fromTest ? 'По тесту на схемы' : 'Отмечена в «Моих паттернах»';
