// Время слотов записи показывается в зоне ПОСЕТИТЕЛЯ, не только в МСК —
// правило №25 CLAUDE.md требует гонять зоно-зависимую логику под несколькими
// зонами, не только под TZ раннера (UTC). forEachTimeZone меняет зону
// ПРОЦЕССА — здесь это не нужно (все функции принимают tz явным аргументом),
// но обходим её всё равно: `new Date(now.getTime()+…)`/`toISOString()` внутри
// clientTimeZone.ts не зависят от зоны процесса, однако тест обязан это
// доказывать, а не предполагать.
import { describe, it, expect } from 'vitest';
import { forEachTimeZone } from '../utils/timeZone.test-helpers';
import {
  resolveClientTimeZone,
  offsetMinutes,
  offsetLabel,
  isMoscowOffset,
  isMoscowTimeZone,
  localDayKey,
  localDayLabel,
  localTimeLabel,
  mskTimeLabel,
  timeZoneCaption,
  mskHintLabel,
  submitTimeSuffix,
  groupByLocalDay,
} from './clientTimeZone';

const ZONES = [
  'Asia/Bangkok',
  'Asia/Novosibirsk',
  'Asia/Seoul',
  'Europe/Moscow',
  'Asia/Kolkata',
  'America/New_York',
];

describe('resolveClientTimeZone', () => {
  it('обходит зоны раннера — не падает и отдаёт валидный пояс', () => {
    forEachTimeZone(() => {
      const tz = resolveClientTimeZone();
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });
  });
});

describe('offsetMinutes / offsetLabel', () => {
  it.each([
    ['Asia/Bangkok', '2026-09-28T00:00:00Z', 7 * 60, 'UTC+7'],
    ['Asia/Kolkata', '2026-09-28T00:00:00Z', 5 * 60 + 30, 'UTC+5:30'],
    ['Europe/Moscow', '2026-09-28T00:00:00Z', 3 * 60, 'UTC+3'],
    ['America/New_York', '2026-01-15T00:00:00Z', -5 * 60, 'UTC-5'],
  ])('%s → %s мин, %s', (tz, iso, minutes, label) => {
    const at = new Date(iso);
    expect(offsetMinutes(tz, at)).toBe(minutes);
    expect(offsetLabel(tz, at)).toBe(label);
  });
});

describe('isMoscowOffset', () => {
  it('Москва сама по себе всегда московская', () => {
    expect(
      isMoscowOffset('Europe/Moscow', new Date('2026-09-28T00:00:00Z')),
    ).toBe(true);
  });

  it('пояс с совпадающим смещением (без своего DST) — тоже московский', () => {
    // Asia/Yekaterinburg — UTC+5, не совпадает; ищем реальное совпадение через Bangkok/Novosibirsk не подходит.
    // Europe/Istanbul круглый год UTC+3 — совпадает с Москвой (без DST в РФ).
    expect(
      isMoscowOffset('Europe/Istanbul', new Date('2026-09-28T00:00:00Z')),
    ).toBe(true);
  });

  it('Бангкок (UTC+7) — не московский', () => {
    expect(
      isMoscowOffset('Asia/Bangkok', new Date('2026-09-28T00:00:00Z')),
    ).toBe(false);
  });
});

// Инцидент 2026-09 (docs/INCIDENTS.md): посетитель из Израиля летом (UTC+3,
// то же смещение, что у Москвы) видел подпись «по московскому времени» —
// isMoscowOffset ловит только совпадение СМЕЩЕНИЯ, а не то, что пояс и есть
// Москва. isMoscowTimeZone — идентичность пояса (Москва и её российские
// синонимы), не совпадение офсета с чужой страной.
describe('isMoscowTimeZone', () => {
  it('Москва и российские синонимы (Симферополь/Киров/Волгоград) — да', () => {
    expect(isMoscowTimeZone('Europe/Moscow')).toBe(true);
    expect(isMoscowTimeZone('Europe/Simferopol')).toBe(true);
    expect(isMoscowTimeZone('Europe/Kirov')).toBe(true);
    expect(isMoscowTimeZone('Europe/Volgograd')).toBe(true);
  });

  it('Стамбул (круглый год UTC+3) — офсет совпадает, но это не Москва', () => {
    expect(isMoscowTimeZone('Europe/Istanbul')).toBe(false);
  });

  it('Израиль летом (UTC+3) и зимой (UTC+2) — в обоих случаях не Москва', () => {
    expect(isMoscowTimeZone('Asia/Jerusalem')).toBe(false);
  });
});

describe('localDayKey / localDayLabel — переход дня через полночь', () => {
  it('23:30 МСК — уже следующий день в Бангкоке (UTC+7)', () => {
    // 23:30 МСК (UTC+3) 27 сентября = 20:30 UTC 27 сентября = 03:30 28 сентября в Бангкоке.
    const iso = '2026-09-27T20:30:00Z';
    expect(localDayKey(iso, 'Europe/Moscow')).toBe('2026-09-27');
    expect(localDayKey(iso, 'Asia/Bangkok')).toBe('2026-09-28');
  });

  it('Сегодня/Завтра считаются в зоне посетителя, не в зоне процесса', () => {
    const now = new Date('2026-09-28T10:00:00Z');
    forEachTimeZone(() => {
      for (const tz of ZONES) {
        expect(localDayLabel(now.toISOString(), tz, now)).toBe('Сегодня');
        const tomorrow = new Date(now.getTime() + 86_400_000).toISOString();
        expect(localDayLabel(tomorrow, tz, now)).toBe('Завтра');
      }
    });
  });

  it('день дальше «завтра» — дата с днём недели', () => {
    const now = new Date('2026-09-28T10:00:00Z');
    const later = new Date(now.getTime() + 5 * 86_400_000).toISOString();
    const label = localDayLabel(later, 'Asia/Bangkok', now);
    expect(label).not.toBe('Сегодня');
    expect(label).not.toBe('Завтра');
    expect(label.length).toBeGreaterThan(0);
  });
});

describe('localTimeLabel / mskTimeLabel', () => {
  it('одно и то же мгновение — разное локальное время в разных поясах', () => {
    const iso = '2026-09-28T12:00:00Z';
    expect(localTimeLabel(iso, 'Europe/Moscow')).toBe('15:00');
    expect(localTimeLabel(iso, 'Asia/Bangkok')).toBe('19:00');
    expect(mskTimeLabel(iso)).toBe('15:00');
  });
});

describe('timeZoneCaption', () => {
  it('московский пояс — без города и смещения', () => {
    expect(
      timeZoneCaption('Europe/Moscow', new Date('2026-09-28T00:00:00Z')),
    ).toBe('Время указано по московскому времени.');
  });

  it('не московский — город и смещение', () => {
    expect(
      timeZoneCaption('Asia/Bangkok', new Date('2026-09-28T00:00:00Z')),
    ).toBe('Время указано по вашему часовому поясу (Бангкок, UTC+7).');
  });

  it('Израиль летом (UTC+3, офсет совпадает с московским) — всё равно «по вашему поясу»', () => {
    expect(
      timeZoneCaption('Asia/Jerusalem', new Date('2026-09-28T00:00:00Z')),
    ).toBe('Время указано по вашему часовому поясу (Израиль, UTC+3).');
  });

  it('Израиль зимой (UTC+2, DST выключен) — тот же принцип с другим смещением', () => {
    expect(
      timeZoneCaption('Asia/Jerusalem', new Date('2026-01-15T00:00:00Z')),
    ).toBe('Время указано по вашему часовому поясу (Израиль, UTC+2).');
  });
});

describe('mskHintLabel', () => {
  it('московский пояс слота — пустая строка (незачем дублировать)', () => {
    expect(mskHintLabel('2026-09-28T12:00:00Z', 'Europe/Moscow')).toBe('');
  });

  it('не московский — второе время в скобках', () => {
    expect(mskHintLabel('2026-09-28T12:00:00Z', 'Asia/Bangkok')).toBe(
      '(15:00 МСК)',
    );
  });

  it('Израиль летом (офсет совпадает с московским) — скобка всё равно показана', () => {
    expect(mskHintLabel('2026-09-28T12:00:00Z', 'Asia/Jerusalem')).toBe(
      '(15:00 МСК)',
    );
  });
});

describe('submitTimeSuffix', () => {
  it('московский пояс — «МСК», иначе — «по вашему времени»', () => {
    expect(submitTimeSuffix('Europe/Moscow')).toBe('МСК');
    expect(submitTimeSuffix('Asia/Seoul')).toBe('по вашему времени');
  });

  it('Израиль (офсет совпадает с московским) — всё равно «по вашему времени»', () => {
    expect(submitTimeSuffix('Asia/Jerusalem')).toBe('по вашему времени');
  });
});

describe('groupByLocalDay', () => {
  it('группирует по календарному дню зоны и сохраняет порядок', () => {
    const slots = [
      { startsAt: '2026-09-27T20:30:00Z' }, // 03:30 след. дня в Бангкоке
      { startsAt: '2026-09-28T02:00:00Z' },
      { startsAt: '2026-09-28T10:00:00Z' },
    ];
    const byBangkok = groupByLocalDay(slots, 'Asia/Bangkok');
    expect([...byBangkok.keys()]).toEqual(['2026-09-28']);
    expect(byBangkok.get('2026-09-28')).toHaveLength(3);

    const byMoscow = groupByLocalDay(slots, 'Europe/Moscow');
    expect([...byMoscow.keys()]).toEqual(['2026-09-27', '2026-09-28']);
  });
});
