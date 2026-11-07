// Код приглашения терапевта глазами клиента — одно правило для полей ввода
// обоих фронтендов (сайт и мини-апп, «Мой терапевт» в настройках).
//
// Инцидент 2026-10-26: сервер выдавал код из 12 знаков, а поле ввода стояло с
// `maxLength={8}` и примером «ABCDEF» — браузер обрезал вставленный код, и
// подключиться по коду не мог никто. Длина живёт здесь одной константой;
// бэкенд — INVITE_CODE_LENGTH в src/therapy/therapy-invite.ts, расхождение
// роняет src/therapy/therapy-invite-code.parity.spec.ts (правило №4).
export const THERAPY_INVITE_CODE_LENGTH = 12;

/** Пример в поле ввода: той же длины и того же вида, что настоящий код. */
export const THERAPY_INVITE_CODE_PLACEHOLDER = '7F3A9C21B04E';

/**
 * Предел поля ввода: с запасом под ссылку целиком — человек вставляет то, что
 * прислал терапевт, а родной `maxLength` режет вставку ДО onChange, и из
 * ссылки или кода с пробелами осталась бы негодная половина.
 */
export const THERAPY_INVITE_INPUT_MAX = 200;

/**
 * Что человек вставил или набрал → код, как его ждёт сервер. Понимает ссылку
 * целиком (`…?startapp=therapy_КОД`), пробелы и переносы по краям и внутри,
 * строчные буквы; лишнее за длиной кода отбрасывается.
 */
export function normalizeTherapyCode(raw: string): string {
  const fromLink = /therapy_([0-9a-z]+)/i.exec(raw);
  const code = (fromLink ? fromLink[1] : raw).replace(/[^0-9a-z]/gi, '');
  return code.toUpperCase().slice(0, THERAPY_INVITE_CODE_LENGTH);
}
