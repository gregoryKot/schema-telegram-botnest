/**
 * Чужая раскладка: запрос, набранный латиницей на русской клавиатуре («ht;bv» → «режим»).
 * Перевод посимвольный, QWERTY → ЙЦУКЕН; знаки, которых нет в таблице, остаются как есть.
 */
const LATIN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`";
const RUSSIAN = 'йцукенгшщзхъфывапролджэячсмитьбюё';

const TO_RUSSIAN = new Map<string, string>();
[...LATIN].forEach((ch, i) => {
  TO_RUSSIAN.set(ch, RUSSIAN[i]);
  if (ch !== ch.toUpperCase()) {
    TO_RUSSIAN.set(ch.toUpperCase(), RUSSIAN[i].toUpperCase());
  }
});

export function toRussianLayout(text: string): string {
  return [...text].map((ch) => TO_RUSSIAN.get(ch) ?? ch).join('');
}

export function hasLatin(text: string): boolean {
  return /[a-z]/i.test(text);
}
