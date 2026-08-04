// Приметы, по которым разбирается фраза внутреннего голоса (упражнение
// «Разобрать фразу»). Здесь — только id: тексты живут во фронтенде
// (schema-miniapp/src/components/phraseCheck/criteria.ts), бэкенду они не
// нужны, а вот валидация присланных id — нужна (данные от клиента не
// принимаются на веру).
//
// Список продублирован во фронтенде, потому что бэкенд не может импортировать
// shared (tsconfig rootDir=src) — как quiz-logic.ts ↔ quizEngine.ts. Паритет
// закреплён одинаковыми списками в phrase-check.service.spec.ts и
// criteria.test.ts: правка одной стороны роняет тест другой.
export const PHRASE_MARK_IDS = [
  // про поступок или про личность целиком
  'person',
  // движущая сила: желание или страх и чужой взгляд
  'fear',
  // точность: факты или ярлыки, «всегда/никогда»
  'absolute',
  // что остаётся после фразы: понятно что делать или хочется исчезнуть
  'shame',
] as const;

export type PhraseMarkId = (typeof PHRASE_MARK_IDS)[number];

export function isPhraseMarkId(value: string): value is PhraseMarkId {
  return (PHRASE_MARK_IDS as readonly string[]).includes(value);
}
