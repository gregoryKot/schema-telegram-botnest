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
} from './alert-gate';

const T0 = 5_000_000;
const sends = (v: { send: boolean }[]) => v.filter((x) => x.send).length;

describe('AlertGate — анонимный подбюджет', () => {
  it('ошибки анонимного контекста упираются в ANON_BUDGET и не тратят основной', () => {
    const gate = new AlertGate();
    const anon = Array.from({ length: 50 }, (_, i) =>
      gate.decide(
        `Google id_token failed: ${'x'.repeat(i)}`,
        'GoogleProvider',
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

// Правило №4: контекст — имя класса в `new Logger(X.name)`. Переименованный
// класс без строки в ANON_ALERT_CONTEXTS молча вернул бы его в основной бюджет.
// Сверка по исходнику: импорт провайдеров тянет ESM-зависимости (jose).
const CONTEXT_FILES: Record<string, string> = {
  AuthFlowService: 'auth/auth-flow.service.ts',
  AuthOauthController: 'auth/auth-oauth.controller.ts',
  GoogleProvider: 'auth/providers/google.provider.ts',
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
