import type { NeedId } from './types';

// Единственный источник названий пяти потребностей (правило №3): контент content/*,
// сайт и копия бэкенда src/bot/need-names.ts (сверка — need-names.sync.spec.ts) берут их отсюда.
// Без импортов значений: спек бэкенда транспилирует файл отдельно.
const NAMES = {
  attachment: 'Привязанность',
  autonomy: 'Автономия',
  expression: 'Выражение чувств',
  play: 'Спонтанность',
  limits: 'Самоконтроль',
} satisfies Record<NeedId, string>;

/** Название потребности по id; ключ — строка, потому что id приходят из данных. */
export const NEED_NAMES: Readonly<Record<string, string>> = NAMES;
