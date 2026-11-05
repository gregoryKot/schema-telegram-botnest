// Гейт класса 20 «Канал есть не у каждого адресата» (docs/INCIDENTS.md):
// уведомление «от другого человека» обязано оставлять след на сайте, и это
// доказано спеком, а не обещано записью. Полнота классификации — на tsc
// (Record<NotificationType, …> в notification-channels.ts); здесь — что у
// каждой записи `from_other` есть живой спек, который называет тип и ручку
// следа, а модель следа есть в schema.prisma. Плюс сверка ключей реестра с
// объединением NotificationType в исходнике (каст `as` мимо tsc).
// Образец и контрольный образец — на подставленных реестрах (правило №15).
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  NOTIFICATION_CHANNELS,
  NotificationChannel,
  undeliveredFromOther,
} from './notification-channels';

const ROOT = join(__dirname, '..', '..');
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8');
const schema = read('prisma/schema.prisma');

/** Нарушения реестра: пустой список — гейт зелёный. */
function violations(
  registry: Record<string, NotificationChannel>,
  readSpec: (path: string) => string | null,
): string[] {
  const out: string[] = [];
  for (const [type, ch] of Object.entries(registry)) {
    if (ch.kind !== 'from_other') continue;
    if (!new RegExp(`^model ${ch.trace} \\{`, 'm').test(schema))
      out.push(`${type}: модели следа ${ch.trace} нет в schema.prisma`);
    const spec = readSpec(ch.spec);
    if (spec === null) {
      out.push(`${type}: спека ${ch.spec} нет`);
      continue;
    }
    if (!spec.includes(`'${type}'`))
      out.push(`${type}: ${ch.spec} не ставит и не проверяет '${type}'`);
    if (!spec.includes(ch.route))
      out.push(`${type}: ${ch.spec} не читает след через ${ch.route}`);
  }
  return out;
}

const readFromRepo = (path: string): string | null =>
  existsSync(join(ROOT, path)) ? read(path) : null;

describe('класс 20: уведомление от другого человека оставляет след на сайте', () => {
  it('реестр проекта чист', () => {
    expect(violations(NOTIFICATION_CHANNELS, readFromRepo)).toEqual([]);
  });

  it('ключи реестра — ровно объединение NotificationType из notification.service.ts', () => {
    const src = read('src/notification/notification.service.ts');
    const union = src.match(/export type NotificationType =([\s\S]*?);/);
    const types = [...(union?.[1] ?? '').matchAll(/'([a-z0-9_]+)'/g)].map(
      (m) => m[1],
    );
    expect(types.length).toBeGreaterThan(20);
    expect(Object.keys(NOTIFICATION_CHANNELS).sort()).toEqual(types.sort());
  });

  it('«от другого» сегодня — задание терапевта, запрос теста и напарник', () => {
    const fromOther = Object.entries(NOTIFICATION_CHANNELS)
      .filter(([, ch]) => ch.kind === 'from_other')
      .map(([t]) => t)
      .sort();
    expect(fromOther).toEqual([
      'pair_activity',
      'task_assigned',
      'ysq_requested',
    ]);
  });

  describe('образец и контрольный образец', () => {
    const ch = {
      kind: 'from_other',
      trace: 'UserTask',
      route: '/api/therapy/tasks',
      spec: 'test/x.e2e-spec.ts',
    } as const;
    const good = `post('/api/therapy/tasks'); type: 'task_assigned'`;
    const only = (text: string | null) => () => text;

    it('контроль: спек называет тип и ручку, модель есть — зелено', () => {
      expect(violations({ task_assigned: ch }, only(good))).toEqual([]);
    });

    it('спека нет — красно', () => {
      expect(violations({ task_assigned: ch }, only(null))).toEqual([
        'task_assigned: спека test/x.e2e-spec.ts нет',
      ]);
    });

    it('спек не называет тип — красно', () => {
      const text = `get('/api/therapy/tasks')`;
      expect(violations({ task_assigned: ch }, only(text))).toEqual([
        "task_assigned: test/x.e2e-spec.ts не ставит и не проверяет 'task_assigned'",
      ]);
    });

    it('спек не читает след через ручку — красно', () => {
      const text = `'task_assigned'`;
      expect(violations({ task_assigned: ch }, only(text))).toEqual([
        'task_assigned: test/x.e2e-spec.ts не читает след через /api/therapy/tasks',
      ]);
    });

    it('модели следа нет в схеме — красно', () => {
      const bad = { ...ch, trace: 'NoSuchModel' };
      expect(violations({ task_assigned: bad }, only(good))).toEqual([
        'task_assigned: модели следа NoSuchModel нет в schema.prisma',
      ]);
    });

    it('`self` спека не требует', () => {
      expect(violations({ reminder: { kind: 'self' } }, only(null))).toEqual(
        [],
      );
    });
  });
});

describe('undeliveredFromOther — хвост строки лога очереди', () => {
  it('все снятые о самом человеке — пусто', () => {
    expect(undeliveredFromOther(['summary', 'reminder'])).toBe('');
    expect(undeliveredFromOther([])).toBe('');
  });

  it('от другого — тип, модель и ручка следа, счётчик', () => {
    expect(
      undeliveredFromOther(['pair_activity', 'summary', 'pair_activity']),
    ).toBe(
      ' От другого человека, след на сайте есть: pair_activity → Rating (/api/pair) ×2.',
    );
  });

  it('неизвестный тип (строка из старой очереди) — не роняет', () => {
    expect(undeliveredFromOther(['gone_type'])).toBe('');
  });
});
