// Проверка подписывающего секрета (JWT_SECRET) — вынесена из env-registry.ts
// (правило №10: файл-реестр не пухнет вместе со списком форматов).

/** Слова-заглушки, которыми заполняют секрет «для вида» (см. formats.secret32). */
const PLACEHOLDER_WORDS = [
  'secret',
  'changeme',
  'password',
  'example',
  'jwt',
  'key',
  'token',
  'test',
];
const SECRET_MIN_LENGTH = 32;
/** Меньше стольких РАЗНЫХ символов — повтор одного/пары символов, не случайность. */
const SECRET_MIN_DISTINCT = 8;

export const checkSecret32 = (value: string): string | null => {
  if (value.length < SECRET_MIN_LENGTH) {
    return `слишком короткий секрет: ${value.length} символов, нужно не меньше ${SECRET_MIN_LENGTH}`;
  }
  if (new Set(value).size < SECRET_MIN_DISTINCT) {
    return 'похоже на заглушку: слишком мало разных символов (повтор одного символа)';
  }
  // Убираем слова-заглушки, цифры и разделители: если ничего содержательного
  // не осталось — секрет собран из «secret» и «123», а не из случайных байт.
  let rest = value.toLowerCase();
  for (const w of PLACEHOLDER_WORDS) rest = rest.split(w).join('');
  if (rest.replace(/[^a-z]/g, '').length < SECRET_MIN_DISTINCT) {
    return 'похоже на заглушку (secret/changeme/password и т.п.), нужен случайный секрет';
  }
  return null;
};
