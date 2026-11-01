// Какой `<input>` во фронтенде — свободный текст пользователя (правило №7):
// признак для трипваера `src/security/crisis-path.invariants.spec.ts`.
//
// Разбор по тексту JSX, без компилятора: тег `<input` до закрывающей `>` на
// нулевой глубине фигурных скобок (иначе `onChange={e => …}` обрезал бы
// атрибуты на стрелке).
//
// Свободным текстом считается любой `<input>`, у которого НЕТ ни одного
// проверяемого признака структурированного ввода:
//   - `type` из закрытого набора (checkbox, number, email, password, search…) —
//     поле со своим форматом или поиск по готовому списку;
//   - `autoComplete="one-time-code"` или `inputMode` numeric/decimal/tel/email/url
//     — код подтверждения, сумма, телефон;
//   - `readOnly` — поле только показывает (ссылка-приглашение для копирования);
//   - `aria-hidden="true"` — ловушка для ботов (honeypot), человек её не видит.
// Нет `type`, `type="text"` или `type={выражение}` — свободный текст: признак
// консервативный, лишний кандидат классифицируется allowlist'ом спека, а
// пропущенный остался бы без кризисного пути молча.

const STRUCTURED_TYPES = new Set([
  'checkbox',
  'radio',
  'range',
  'file',
  'hidden',
  'color',
  'date',
  'time',
  'datetime-local',
  'month',
  'week',
  'number',
  'email',
  'password',
  'tel',
  'url',
  'search',
  'submit',
  'button',
  'reset',
  'image',
]);
const STRUCTURED_INPUT_MODES = new Set([
  'numeric',
  'decimal',
  'tel',
  'email',
  'url',
]);

/** Текст атрибутов каждого `<input …>` в исходнике (между `<input` и `>`). */
export function inputTags(src: string): string[] {
  const out: string[] = [];
  const re = /<input\b/g;
  for (let m = re.exec(src); m !== null; m = re.exec(src)) {
    let depth = 0;
    let i = m.index + m[0].length;
    for (; i < src.length; i++) {
      const c = src[i];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    out.push(src.slice(m.index + m[0].length, i));
  }
  return out;
}

const attr = (tag: string, name: string): string | null =>
  tag
    .match(new RegExp(`\\b${name}=(?:"([^"]*)"|\\{\\s*'([^']*)'\\s*\\})`))
    ?.slice(1)
    .find((v) => v !== undefined) ?? null;

/** Есть ли у тега признак структурированного ввода (см. шапку файла). */
export function isStructuredInput(tag: string): boolean {
  const type = attr(tag, 'type');
  if (type !== null && STRUCTURED_TYPES.has(type)) return true;
  if (attr(tag, 'autoComplete') === 'one-time-code') return true;
  const mode = attr(tag, 'inputMode');
  if (mode !== null && STRUCTURED_INPUT_MODES.has(mode)) return true;
  if (/\breadOnly\b(?!=\{false\})/.test(tag)) return true;
  if (attr(tag, 'aria-hidden') === 'true') return true;
  return false;
}

/** Есть ли в исходнике хотя бы один `<input>` со свободным текстом. */
export function hasFreeTextInput(src: string): boolean {
  return inputTags(src).some((tag) => !isStructuredInput(tag));
}
