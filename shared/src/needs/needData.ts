import { useAddressForm, type AddressForm } from '../utils/addressForm';
import type { NeedDataMap } from './types';
import { buildAttachment } from './content/attachment';
import { buildAutonomy } from './content/autonomy';
import { buildExpression } from './content/expression';
import { buildPlay } from './content/play';
import { buildLimits } from './content/limits';

export { NEED_ORDER } from './types';
export type { NeedId, NeedExtra, NeedDataMap, Tr } from './types';

// Единственный источник контента пяти потребностей (правило №3 CLAUDE.md).
// Раньше это были две почти-идентичные копии — webapp/src/needData.ts и
// schema-miniapp/src/needData.ts — главный источник jscpd-дублей в проекте.
// Оба фронтенда теперь ре-экспортируют этот модуль без изменений сигнатур.
// Сам текст — в content/*.ts (один файл на потребность, правило №10: держит
// каждый файл в пределах разумного размера); здесь только сборка и хуки.
export const buildNeedData = (
  tr: (ty: string, vy: string) => string,
): NeedDataMap => ({
  attachment: buildAttachment(tr),
  autonomy: buildAutonomy(tr),
  expression: buildExpression(tr),
  play: buildPlay(tr),
  limits: buildLimits(tr),
});

// Форма обращения не меняется в рамках сессии часто — кешируем по форме,
// чтобы не пересобирать объект на каждый рендер.
const _needCache: Partial<Record<AddressForm, NeedDataMap>> = {};

export function getNeedData(form: AddressForm): NeedDataMap {
  return (_needCache[form] ??= buildNeedData((ty, vy) =>
    form === 'vy' ? vy : ty,
  ));
}

export function useNeedData(): NeedDataMap {
  return getNeedData(useAddressForm());
}
