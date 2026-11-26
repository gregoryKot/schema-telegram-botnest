/**
 * Прозрачная версия цвета: `color-mix(in srgb, X N%, transparent)`.
 * Работает и с токенами (`var(--accent-red)`), и с hex. Дописывать к
 * `var(--токен)` две hex-цифры альфы нельзя — значение невалидно «на этапе
 * вычисления» и свойство молча сбрасывается (CLAUDE.md, PR #520).
 */
export function colorMix(color: string, pct: number): string {
  return `color-mix(in srgb, ${color} ${pct}%, transparent)`;
}
