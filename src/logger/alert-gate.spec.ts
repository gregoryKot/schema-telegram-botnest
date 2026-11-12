// AlertGate — решение «уходит ли error() в DM». Здесь — то, что добавил аудит
// 2026-11 (S13): анонимный подбюджет и `seen` после решения бюджета. Слои
// ключа и общего потолка покрыты через AlertLogger в alert.logger.spec.ts.
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  ANON_ALERT_CONTEXTS,
  ANON_BUDGET,
  AlertGate,
  MAIN_BUDGET,
  MONEY_BUDGET,
} from './alert-gate';
import { moneyAlert } from './money-alert';

const T0 = 5_000_000;
const sends = (v: { send: boolean }[]) => v.filter((x) => x.send).length;

describe('AlertGate — анонимный подбюджет', () => {
  it('ошибки анонимного контекста упираются в ANON_BUDGET и не тратят основной', () => {
    const gate = new AlertGate();
    const anon = Array.from({ length: 50 }, (_, i) =>
      gate.decide(
        `vk callback error: ${'x'.repeat(i)}`,
        'AuthOauthController',
        T0,
      ),
    );
    expect(sends(anon)).toBe(ANON_BUDGET);
    const main = Array.from({ length: MAIN_BUDGET }, (_, i) =>
      gate.decide(`subsystem ${'y'.repeat(i)} failed`, 'PrismaService', T0),
    );
    expect(sends(main)).toBe(MAIN_BUDGET);
  });

  it('контроль: без контекста и с чужим контекстом — основной бюджет', () => {
    const gate = new AlertGate();
    const v = Array.from({ length: 10 }, (_, i) =>
      gate.decide(
        `err ${'z'.repeat(i)}`,
        i % 2 ? undefined : 'BookingService',
        T0,
      ),
    );
    expect(sends(v)).toBe(10);
  });

  it('следующее окно сообщает, сколько подавил анонимный потолок', () => {
    const gate = new AlertGate();
    for (let i = 0; i < ANON_BUDGET + 4; i++)
      gate.decide(
        `vk callback error: ${'q'.repeat(i)}`,
        'AuthOauthController',
        T0,
      );
    const next = gate.decide(
      'vk callback error: свежая',
      'AuthOauthController',
      T0 + 61_000,
    );
    expect(next).toEqual({
      send: true,
      tail: expect.stringContaining('подавлено ещё 4 — потолок ошибок входа'),
    });
  });
});

describe('AlertGate — seen после решения бюджета', () => {
  it('ошибка, упёршаяся в потолок, доходит в новом окне бюджета даже внутри 60 с ключа', () => {
    const gate = new AlertGate();
    for (let i = 0; i < MAIN_BUDGET; i++)
      gate.decide(`fill ${'a'.repeat(i)}`, undefined, T0);
    expect(gate.decide('настоящая авария', undefined, T0 + 30_000).send).toBe(
      false,
    );
    // Окно бюджета (60 с от T0) обновилось, а до 60 с «ключа» ошибки ещё далеко.
    expect(gate.decide('настоящая авария', undefined, T0 + 61_000).send).toBe(
      true,
    );
  });

  it('доставленная ошибка по-прежнему троттлится ключом 60 с', () => {
    const gate = new AlertGate();
    expect(gate.decide('Failed id=1', undefined, T0).send).toBe(true);
    expect(gate.decide('Failed id=2', undefined, T0 + 10_000).send).toBe(false);
  });
});

// Хвост R9 (аудит 2026-11): второй «платёж без строки в БД» с другим InvId в
// те же 60 с гасился ключом (цифры схлопывались) и оставался только в логе.
describe('AlertGate — денежные алерты', () => {
  const lost = (invId: number) =>
    moneyAlert(
      `Robokassa: оплата подписки, InvId ${invId} (500 ₽), без строки`,
    );

  it('два платежа с разными InvId за 60 с — оба уходят владельцу', () => {
    const gate = new AlertGate();
    expect(gate.decide(lost(1500000001), undefined, T0).send).toBe(true);
    expect(gate.decide(lost(1500000002), undefined, T0 + 5_000).send).toBe(
      true,
    );
  });

  it('повтор вебхука с тем же InvId в окне ключа — не дублируется', () => {
    const gate = new AlertGate();
    expect(gate.decide(lost(1500000001), undefined, T0).send).toBe(true);
    expect(gate.decide(lost(1500000001), undefined, T0 + 5_000).send).toBe(
      false,
    );
  });

  it('общий потолок, выжженный прочими ошибками, денежный алерт не глушит', () => {
    const gate = new AlertGate();
    for (let i = 0; i < MAIN_BUDGET + 5; i++)
      gate.decide(`noise ${'n'.repeat(i)}`, undefined, T0);
    expect(gate.decide(lost(1500000003), undefined, T0 + 1_000).send).toBe(
      true,
    );
  });

  it('сверх денежного потолка — счётчик в первом алерте следующего окна', () => {
    const gate = new AlertGate();
    const v = Array.from({ length: MONEY_BUDGET + 2 }, (_, i) =>
      gate.decide(lost(1500000100 + i), undefined, T0),
    );
    expect(sends(v)).toBe(MONEY_BUDGET);
    expect(gate.decide(lost(1500000200), undefined, T0 + 61_000)).toEqual({
      send: true,
      tail: expect.stringContaining('подавлено ещё 2 — потолок денежных'),
    });
  });

  it('контроль: тот же текст без метки по-прежнему схлопывается ключом', () => {
    const gate = new AlertGate();
    const plain = (n: number) => `Robokassa: оплата, InvId ${n}, без строки`;
    expect(gate.decide(plain(1), undefined, T0).send).toBe(true);
    expect(gate.decide(plain(2), undefined, T0 + 5_000).send).toBe(false);
  });
});

// Правило №4: контекст — имя класса в `new Logger(X.name)`. Переименованный
// класс без строки в ANON_ALERT_CONTEXTS молча вернул бы его в основной бюджет.
// Сверка по исходнику: импорт провайдеров тянет ESM-зависимости (jose).
const CONTEXT_FILES: Record<string, string> = {
  AuthOauthController: 'auth/auth-oauth.controller.ts',
};

describe('ANON_ALERT_CONTEXTS ↔ имена классов', () => {
  it('список совпадает с картой файлов', () => {
    expect([...ANON_ALERT_CONTEXTS].sort()).toEqual(
      Object.keys(CONTEXT_FILES).sort(),
    );
  });

  it.each(Object.entries(CONTEXT_FILES))(
    '%s — класс в %s логирует под своим именем',
    (name, file) => {
      const src = readFileSync(join(__dirname, '..', file), 'utf8');
      expect(src).toContain(`export class ${name} `);
      expect(src).toContain(`new Logger(${name}.name)`);
    },
  );
});
