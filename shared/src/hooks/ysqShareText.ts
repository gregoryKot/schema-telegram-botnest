import { SCHEMAS } from './ysqSchemas';
import { isSchemaScoreActive, type SchemaScore } from './ysqScoring';

// Развёрнутый текстовый фолбэк «поделиться результатом» — вынесено из
// useYsqTest.ts (правило №10, файл был у потолка). Нейтральные формулировки
// (без ты/вы) — текст уходит третьим лицам.
export function buildShareText(
  scores: Record<string, SchemaScore>,
  dateLabel: string | null,
): string {
  const active = SCHEMAS.filter((s) => isSchemaScoreActive(scores[s.name]));
  const lines: string[] = [
    `Мой результат теста на схемы${dateLabel ? ` — ${dateLabel}` : ''}`,
    '',
  ];
  if (active.length === 0) {
    lines.push('Выраженных схем не обнаружено.');
  } else {
    lines.push(`Выраженные схемы (${active.length}):`);
    for (const s of active) {
      const sc = scores[s.name];
      lines.push(
        `• ${s.name} — средний балл ${sc.avg} из 6 (ответов «5–6»: ${sc.n5plus} из ${sc.nQuestions})`,
      );
    }
  }
  lines.push(
    '',
    'Средний балл — насколько утверждения схемы в среднем про меня (от 4 из 6 — выражена).',
    'Образовательный опросник для самонаблюдения, не диагноз. schemehappens.ru',
  );
  return lines.join('\n');
}
