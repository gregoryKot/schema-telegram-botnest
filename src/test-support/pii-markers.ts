// «Отравленные» данные человека для тестов сообщений владельцу в Telegram:
// каждое значение — уникальная строка. Карточку собирают из маркеров, и ни
// один не должен встретиться ни в тексте, ни в кнопках (152-ФЗ: в мессенджер
// уходят только событие, id, время, статус и сумма). Письмо их нести может.

export const PII = {
  name: 'MARK_NAME_q7',
  contact: 'mark_contact_q7',
  message: 'MARK_MESSAGE_q7',
  comment: 'MARK_COMMENT_q7',
  email: 'mark_q7@example.test',
  source: 'https://mark.example.test/landing?utm=MARK_SOURCE_q7',
  ip: '203.0.113.77',
  ua: 'MarkAgent_q7/1.0',
  path: '/mark-path-q7',
  qualification: 'MARK_QUAL_q7',
  error: 'MARK_ERROR_q7',
  robokassa: 'MARK_ROBOKASSA_q7',
  /** IANA-пояс клиента: местоположение. */
  timeZone: 'Asia/Bangkok',
  telegramId: 7700770077n,
} as const;

/** Как пояс выглядит в тексте карточки: город и «у клиента 19:00». */
const DERIVED = ['Бангкок', 'у клиента'];

/** Все строки, которых не должно быть в Telegram-карточке. */
export const PII_MARKERS: readonly string[] = [
  ...Object.values(PII).map(String),
  ...DERIVED,
];

/** Маркеры, найденные в тексте (пусто — карточка чистая). */
export function findMarkers(text: string): string[] {
  return PII_MARKERS.filter((m) => text.includes(m));
}

/** Ни одного маркера ни в тексте, ни в разметке кнопок. */
export function expectNoMarkers(text: string, replyMarkup?: unknown): void {
  const all =
    replyMarkup === undefined
      ? text
      : `${text}\n${JSON.stringify(replyMarkup)}`;
  expect(findMarkers(all)).toEqual([]);
}
