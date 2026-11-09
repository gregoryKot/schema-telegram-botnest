import { SAFE_PLACE_TEXT_MAX } from '../../../../shared/src/limits/textLimits';

// Безопасное место уходит на сервер одной строкой (`SafePlaceDto.description`,
// предел `SAFE_PLACE_TEXT_MAX`): общее впечатление и органы чувств с
// подписями через перевод строки. Полей на экране пять, поэтому предел
// одного — доля общего за вычетом подписей, округлённая вниз до сотни: пять
// полей, заполненных до края, всё равно проходят `@MaxLength`. Раньше поля
// были без предела, и длинный текст упирался в 400, а экран писал «проверь
// соединение» — повтор не помогал.
export const SENSES = [
  {
    k: 'see',
    label: 'Что я вижу',
    ph: 'высокие сосны, солнце сквозь ветки, мхом покрытый камень…',
  },
  {
    k: 'hear',
    label: 'Что я слышу',
    ph: 'шорох листьев, где-то птица, тишина…',
  },
  {
    k: 'feel',
    label: 'Что я чувствую телом',
    ph: 'тёплый ветер, шершавая кора под рукой, мягкая земля…',
  },
  {
    k: 'smell',
    label: 'Что я обоняю',
    ph: 'хвоя, дождь, дым от далёкого костра…',
  },
] as const;

const senseLine = (label: string, text: string) => `${label}: ${text}`;

// Подписи и переводы строк, которые добавляет сборка описания.
const OVERHEAD = SENSES.reduce((n, s) => n + senseLine(s.label, '').length + 1, 0);

export const SAFE_PLACE_FIELD_MAX =
  Math.floor((SAFE_PLACE_TEXT_MAX - OVERHEAD) / (SENSES.length + 1) / 100) * 100;

/** Описание для сервера: впечатление и заполненные органы чувств с подписями. */
export function buildSafePlaceDescription(
  overview: string,
  senses: Record<string, string>,
): string {
  return [
    overview,
    ...SENSES.filter((s) => senses[s.k]?.trim()).map((s) =>
      senseLine(s.label, senses[s.k]),
    ),
  ].join('\n');
}
