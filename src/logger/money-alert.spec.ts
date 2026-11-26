// РКН (#1135): текст moneyAlert(…) уходит владельцу в DM целиком
// (alert-text.ts) — в нём только InvId, сумма и статус. Текст ошибки, email и
// имя туда не интерполируются: ошибка идёт вторым аргументом error() и
// остаётся в логе приложения. Трипваер читает исходники, как
// src/security/log-leak.invariants.spec.ts.
import { readFileSync } from 'fs';
import { join } from 'path';
import { collectSourceFiles } from '../security/collect-source-files';
import { isMoneyAlert, moneyAlert } from './money-alert';

const SRC = join(__dirname, '..');

/** Интерполяция, которая тащит в DM текст ошибки или данные человека. */
const DANGER =
  /\$\{[^}]*(\.message|\.stack|\.description|String\(|JSON\.stringify|inspect\(|email|name|contact|phone|\berr\b|\be\b|\berror\b)[^}]*\}/i;

/** Аргументы каждого вызова moneyAlert( … ) с учётом вложенных скобок. */
function moneyAlertArgs(src: string): { arg: string; at: number }[] {
  const found: { arg: string; at: number }[] = [];
  for (const m of src.matchAll(/\bmoneyAlert\(/g)) {
    const start = (m.index ?? 0) + m[0].length;
    let depth = 1;
    let i = start;
    while (depth > 0 && i < src.length) {
      if (src[i] === '(') depth += 1;
      if (src[i] === ')') depth -= 1;
      i += 1;
    }
    found.push({ arg: src.slice(start, i - 1), at: m.index ?? 0 });
  }
  return found;
}

describe('moneyAlert: в DM только InvId, сумма и статус', () => {
  const calls = collectSourceFiles(SRC)
    .filter((f) => !f.endsWith('money-alert.ts'))
    .flatMap((f) => {
      const src = readFileSync(f, 'utf8');
      return moneyAlertArgs(src).map(({ arg, at }) => ({
        arg,
        where: `${f.replace(SRC, 'src')}:${src.slice(0, at).split('\n').length}`,
      }));
    });

  it('вызовы нашлись (санити: бронь, подписка, донат)', () => {
    expect(calls.length).toBeGreaterThanOrEqual(4);
  });

  it('ни один вызов не интерполирует текст ошибки или данные человека', () => {
    const offenders = calls
      .filter(({ arg }) => DANGER.test(arg))
      .map(({ where }) => where);
    expect(offenders).toEqual([]);
  });

  it('трипваер ловит текст ошибки и пропускает InvId с суммой (оба исхода)', () => {
    const bad = moneyAlertArgs(
      'x(moneyAlert(`failed ${id}: ${(e as Error).message}`));',
    );
    const good = moneyAlertArgs(
      "x(moneyAlert(`InvId ${invId} (${paidAmount ?? '?'} ₽)`));",
    );
    expect(DANGER.test(bad[0].arg)).toBe(true);
    expect(DANGER.test(good[0].arg)).toBe(false);
  });

  it('метка узнаётся AlertGate', () => {
    expect(isMoneyAlert(moneyAlert('InvId 7'))).toBe(true);
    expect(isMoneyAlert('InvId 7')).toBe(false);
  });
});
