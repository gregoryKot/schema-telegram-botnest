/**
 * Разбор и отбраковка пачки фраз, вставленной в админке списком.
 *
 * Пул пополняется вручную (см. HEALTHY_ADULT.md), поэтому в него легко
 * занести то же самое дважды или два текста с одинаковым зачином — бриф
 * прямо запрещает повторять стартовые конструкции. Проверяем это здесь, а не
 * глазами: человек, вставляющий 20 строк, зачины не сверит.
 */

/** Верхняя граница длины сообщения канала (символы). */
export const MAX_PHRASE_LEN = 600;

/**
 * Сколько первых слов считаем «стартовой конструкцией». Три: на двух словах
 * фильтр ловил частые безобидные предлоги как «повтор» и терял хорошие фразы
 * («Что бы сегодня…» ⟂ «Что бы ты сказал…»; «Ты называешь себя…» ⟂ «Ты
 * называешь это…» — совпадали лишь «что бы» / «ты называешь»). Три слова
 * оставляют отсев на действительно одинаковых зачинах.
 *
 * Пропущенный двусловный повтор («Ты сегодня A» / «Ты сегодня B») не страшен:
 * пачку владелец читает глазами перед вставкой, а от повтора В КАНАЛЕ подряд
 * защищает LRU-ротация пула — этот фильтр лишь подстраховка при импорте, и
 * ложное срабатывание здесь вреднее пропуска.
 */
const OPENING_WORDS = 3;

export interface RejectedPhrase {
  text: string;
  reason: string;
}

export interface ImportPreparation {
  accepted: string[];
  rejected: RejectedPhrase[];
}

/**
 * Нормализованный зачин: первые слова в нижнем регистре без пунктуации.
 * Пустая строка, если слов меньше порога — тогда по зачину не сравниваем.
 */
function opening(text: string): string {
  const words = text
    .toLowerCase()
    .replace(/[«»"'.,!?;:()—–-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
  return words.length >= OPENING_WORDS
    ? words.slice(0, OPENING_WORDS).join(' ')
    : '';
}

/** Убрать кавычки-обёртки и заменить длинное тире (бриф его запрещает). */
function normalize(line: string): string {
  return line
    .trim()
    .replace(/^[«"']+|[»"']+$/g, '')
    .replace(/—/g, '–')
    .trim();
}

/**
 * Разобрать вставленный текст (по фразе на строку) и разделить на принятые
 * и отсеянные с причиной. `existing` — тексты, уже лежащие в пуле.
 */
export function prepareImport(
  raw: string,
  existing: string[],
): ImportPreparation {
  const existingOpenings = new Map<string, string>();
  for (const text of existing) {
    const key = opening(text);
    if (key !== '' && !existingOpenings.has(key))
      existingOpenings.set(key, text);
  }
  const existingTexts = new Set(existing.map((t) => t.trim()));

  const accepted: string[] = [];
  const rejected: RejectedPhrase[] = [];

  for (const line of raw.split('\n')) {
    const text = normalize(line);
    if (text === '') continue; // пустые строки — просто разделители, не ошибка

    if (text.length > MAX_PHRASE_LEN) {
      rejected.push({
        text,
        reason: `длиннее ${MAX_PHRASE_LEN} символов`,
      });
      continue;
    }
    if (existingTexts.has(text)) {
      rejected.push({ text, reason: 'уже есть в пуле' });
      continue;
    }
    const key = opening(text);
    const twin = key === '' ? undefined : existingOpenings.get(key);
    if (twin !== undefined) {
      rejected.push({ text, reason: `начинается так же, как «${twin}»` });
      continue;
    }

    accepted.push(text);
    existingTexts.add(text);
    if (key !== '') existingOpenings.set(key, text);
  }

  return { accepted, rejected };
}

/** Человеческий отчёт для админки: что добавилось и что отсеялось. */
export function formatImportReport(result: ImportPreparation): string {
  const { accepted, rejected } = result;
  if (accepted.length === 0 && rejected.length === 0) {
    return 'Пусто — нечего добавлять.';
  }
  const lines: string[] = [];
  lines.push(
    accepted.length === 0
      ? 'Ничего не добавлено.'
      : `Добавлено: ${accepted.length}.`,
  );
  if (rejected.length > 0) {
    lines.push(`Пропущено: ${rejected.length}.`);
    for (const r of rejected) {
      const short = r.text.length > 60 ? `${r.text.slice(0, 60)}…` : r.text;
      lines.push(`• «${short}» — ${r.reason}`);
    }
  }
  return lines.join('\n');
}
