// .ics шага плана по https (аудит 2026-11, E6): токен в ссылке запечатан
// AES-GCM — без ключа не прочитать и не подделать, просроченный не открыть;
// текст практики не ломает формат файла.
import { loadWithKeys } from '../test-support/load-with-keys';

type Mod = typeof import('./practice-ics');
const KEY = 'a'.repeat(64);
const load = (key: string): Mod =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  loadWithKeys({ key }, () => require('./practice-ics') as Mod);

const EVENT = {
  text: 'Позвонить маме',
  needLabel: 'Привязанность',
  startMs: Date.UTC(2026, 10, 9, 16),
};
const NOW = Date.UTC(2026, 10, 8, 12);

describe('sealPracticeIcs / openPracticeIcs', () => {
  const m = load(KEY);

  it('сохранил → открыл то же событие; в токене нет открытого текста', () => {
    const token = m.sealPracticeIcs(EVENT, NOW);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(Buffer.from(token, 'base64url').toString('utf8')).not.toContain(
      'маме',
    );
    expect(m.openPracticeIcs(token, NOW + 60_000)).toEqual(EVENT);
  });

  it('через сутки ссылка устарела', () => {
    const token = m.sealPracticeIcs(EVENT, NOW);
    expect(m.openPracticeIcs(token, NOW + 24 * 3_600_000 + 1)).toBeNull();
  });

  it('подделка, мусор и токен чужого ключа — null, без исключения', () => {
    const token = m.sealPracticeIcs(EVENT, NOW);
    const flipped = token[10] === 'A' ? 'B' : 'A';
    expect(
      m.openPracticeIcs(token.slice(0, 10) + flipped + token.slice(11), NOW),
    ).toBeNull();
    expect(m.openPracticeIcs('does-not-exist-token', NOW)).toBeNull();
    expect(m.openPracticeIcs('x'.repeat(5000), NOW)).toBeNull();
    const other = load('b'.repeat(64));
    expect(other.openPracticeIcs(token, NOW)).toBeNull();
  });

  it('шифротекст того же ключа без метки назначения (поле из БД) — null', () => {
    const crypto = loadWithKeys(
      { key: KEY },
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      () => require('../utils/crypto') as typeof import('../utils/crypto'),
    );
    const json = JSON.stringify({ t: 'x', n: 'y', s: 1, e: NOW + 60_000 });
    const foreign = Buffer.from(crypto.encrypt(json), 'base64').toString(
      'base64url',
    );
    expect(m.openPracticeIcs(foreign, NOW)).toBeNull();
  });

  it('без ключа ссылку не выдаёт: открытый текст в адрес не кладётся', () => {
    const noKey = load('');
    // Класс исключения из изолированной копии @nestjs/common — сверяем статус.
    expect(() => noKey.sealPracticeIcs(EVENT, NOW)).toThrow(
      expect.objectContaining({ status: 503 }),
    );
  });
});

describe('practiceIcsText', () => {
  const m = load(KEY);

  // RFC 5545 складывает строки длиннее 75 байт — сверяем развёрнутый текст.
  const unfold = (ics: string) => ics.replace(/\r\n /g, '');

  it('событие с сигналом в начале, по полчаса, в UTC', () => {
    const ics = unfold(m.practiceIcsText(EVENT));
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART:20261109T160000Z');
    expect(ics).toContain('DTEND:20261109T163000Z');
    expect(ics).toContain('SUMMARY:Позвонить маме');
    expect(ics).toContain(
      'DESCRIPTION:Практика для потребности: Привязанность',
    );
    expect(ics).toContain('BEGIN:VALARM');
  });

  // Хвост 5.6 (E6, аудит 2026-11): сигнал практики был подписан «Напоминание
  // о встрече» — текст брони, зашитый в buildValarm.
  it('сигнал подписан текстом практики, не «Напоминание о встрече»', () => {
    const ics = unfold(m.practiceIcsText(EVENT));
    const alarm = ics.slice(ics.indexOf('BEGIN:VALARM'));
    expect(alarm).toContain('DESCRIPTION:Позвонить маме\r\n');
    expect(ics).not.toContain('Напоминание о встрече');
  });

  it('пустой текст практики — сигнал «Практика»', () => {
    const ics = unfold(m.practiceIcsText({ ...EVENT, text: '  ' }));
    const alarm = ics.slice(ics.indexOf('BEGIN:VALARM'));
    expect(alarm).toContain('DESCRIPTION:Практика\r\n');
  });

  it('перенос строки в тексте не дописывает в файл свои свойства', () => {
    const ics = unfold(
      m.practiceIcsText({ ...EVENT, text: 'шаг\r\nURL:https://evil.example' }),
    );
    expect(ics.split('\r\n').some((l) => l.startsWith('URL:'))).toBe(false);
  });
});
