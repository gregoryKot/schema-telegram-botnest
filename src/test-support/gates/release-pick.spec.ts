// Выбор коммита для суточной выкатки (scripts/release-pick.mjs): на прод уходит
// только зелёный коммит main, красный main поднимает сигнал, повтор — без пуша.
import { runGate } from './gate-sandbox';

const sha = (c: string) => c.repeat(40);
const [A, B, C, D] = ['a', 'b', 'c', 'd'].map(sha);
const done = (s: string, conclusion: string) => ({
  sha: s,
  status: 'completed',
  conclusion,
});

function pick(input: object, args: string[] = []) {
  const res = runGate(
    'release-pick.mjs',
    { 'input.json': JSON.stringify(input) },
    { args: ['--input=input.json', ...args] },
  );
  const out = Object.fromEntries(
    res.stdout
      .trim()
      .split('\n')
      .map((l) => l.split(/=(.*)/s).slice(0, 2)),
  );
  return { status: res.status, ...out };
}

describe('release-pick.mjs', () => {
  it('зелёная голова main — уходит она', () => {
    const r = pick({
      commits: [A, B, C],
      runs: [done(A, 'success'), done(B, 'success')],
      deployed: C,
    });
    expect(r).toMatchObject({ action: 'release', sha: A, mainRed: 'false' });
  });

  it('голова ещё в CI — уходит последний зелёный, сигнала нет', () => {
    const r = pick({
      commits: [A, B, C],
      runs: [
        { sha: A, status: 'in_progress', conclusion: null },
        done(B, 'success'),
      ],
      deployed: C,
    });
    expect(r).toMatchObject({ action: 'release', sha: B, mainRed: 'false' });
  });

  it('красная голова — уходит зелёный под ней, сигнал поднят', () => {
    const r = pick({
      commits: [A, B, C],
      runs: [done(A, 'failure'), done(B, 'success')],
      deployed: C,
    });
    expect(r).toMatchObject({ action: 'release', sha: B, mainRed: 'true' });
  });

  it('зелёного новее прода нет — день пропущен с сигналом, старый зелёный не берётся', () => {
    const r = pick({
      commits: [A, B, C, D],
      runs: [
        done(A, 'failure'),
        done(B, 'cancelled'),
        done(C, 'success'),
        done(D, 'success'),
      ],
      deployed: C,
    });
    expect(r).toMatchObject({ action: 'none', mainRed: 'true' });
  });

  it('на проде уже голова main — без пуша и без сигнала', () => {
    const r = pick({
      commits: [A, B],
      runs: [done(A, 'success')],
      deployed: A,
    });
    expect(r).toMatchObject({ action: 'none', mainRed: 'false' });
  });

  it('ветки production ещё нет — уходит последний зелёный', () => {
    const r = pick({
      commits: [A, B],
      runs: [done(A, 'success')],
      deployed: null,
    });
    expect(r).toMatchObject({ action: 'release', sha: A });
  });

  it('перезапуск прогона: решает самый новый прогон коммита', () => {
    const r = pick({
      commits: [A, B],
      runs: [done(A, 'success'), done(A, 'failure')],
      deployed: B,
    });
    expect(r).toMatchObject({ action: 'release', sha: A, mainRed: 'false' });
  });

  it('--sha: откат на коммит main без оглядки на CI; чужой коммит — exit 1', () => {
    const input = {
      commits: [A, B, C],
      runs: [done(B, 'failure')],
      deployed: A,
    };
    expect(pick(input, [`--sha=${B}`])).toMatchObject({
      action: 'release',
      sha: B,
    });
    expect(pick(input, [`--sha=${D}`])).toMatchObject({
      status: 1,
      action: 'error',
    });
  });
});
