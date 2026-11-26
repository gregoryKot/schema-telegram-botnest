// Транзитивный разбор вызовов в check-cron-leader.mjs (модуль правил —
// check-cron-leader-rules.mjs). Класс находки «досылка в канал запускалась
// двумя кронами»: общий метод под двумя разными арендами — каждая страхует
// только свой тик, побочный эффект идёт дважды. Оба исхода плюс контрольные
// образцы: законный общий хелпер гасится записью shared, а leader-крон,
// зовущий тело другого leader-крона, — нет.
import { runGate } from './gate-sandbox';
import { loadStringList } from './pattern-loader';

const LEADER = { status: 'leader', reason: 'дубль тика шлёт сообщение дважды' };
const svc = (...methods: string[]) =>
  ['export class S {', ...methods, '}', ''].join('\n');
const cron = (name: string, body: string) =>
  [
    `  @Cron('*/5 * * * *')`,
    `  async ${name}(): Promise<void> {`,
    `    ${body}`,
    '  }',
  ].join('\n');
const method = (name: string, body: string) =>
  [
    `  private async ${name}(x: number): Promise<void> {`,
    `    ${body}`,
    '  }',
  ].join('\n');
const run = (src: string, baseline: Record<string, unknown>) =>
  runGate('check-cron-leader.mjs', {
    'src/s.service.ts': src,
    'scripts/cron-leader-baseline.json': JSON.stringify(baseline),
  });

describe('check-cron-leader.mjs — транзитивный разбор внутри класса', () => {
  it('claimRun в методе-обёртке, до которого доходит крон, засчитывается', () => {
    const src = svc(
      cron('tick', 'await this.leased(1);'),
      method(
        'leased',
        "if (!(await this.leader.claimRun('tick'))) return; await this.work(x);",
      ),
      method('work', 'await this.publisher.post();'),
    );
    const res = run(src, { 'src/s.service.ts::tick': LEADER });
    expect(res.status).toBe(0);
  });

  it('контроль: обёртка без claimRun — leader красный', () => {
    const src = svc(
      cron('tick', 'await this.leased(1);'),
      method('leased', 'await this.work(x);'),
    );
    const res = run(src, { 'src/s.service.ts::tick': LEADER });
    expect(res.stderr).toContain('объявлен leader, но claimRun(');
  });

  it('метод под арендами двух leader-кронов — красный, с именами кронов', () => {
    const src = svc(
      cron(
        'tickA',
        "if (!(await this.l.claimRun('a'))) return; await this.post(1);",
      ),
      cron(
        'tickB',
        "if (!(await this.l.claimRun('b'))) return; await this.post(2);",
      ),
      method('post', 'await this.publisher.publish();'),
    );
    const res = run(src, {
      'src/s.service.ts::tickA': LEADER,
      'src/s.service.ts::tickB': LEADER,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'src/s.service.ts::post: метод под арендами двух leader-кронов (tickA, tickB)',
    );
  });

  it('shared с причиной гасит общий хелпер; короткая причина — красный', () => {
    const src = svc(
      cron(
        'tickA',
        "if (!(await this.l.claimRun('a'))) return; await this.alert(1);",
      ),
      cron(
        'tickB',
        "if (!(await this.l.claimRun('b'))) return; await this.alert(2);",
      ),
      method('alert', 'await notifyAdmin(x);'),
    );
    const base = {
      'src/s.service.ts::tickA': LEADER,
      'src/s.service.ts::tickB': LEADER,
    };
    const shared = {
      status: 'shared',
      reason: 'DM владельцу о своём тике, повтор поста не делает',
    };
    const ok = run(src, { ...base, 'src/s.service.ts::alert': shared });
    expect(ok.status).toBe(0);
    expect(ok.stdout).toContain('общих методов под арендами — 1');
    const short = run(src, {
      ...base,
      'src/s.service.ts::alert': { status: 'shared', reason: 'ок' },
    });
    expect(short.stderr).toContain('shared без внятной причины');
  });

  it('контроль: leader-крон зовёт тело другого leader-крона — красный, shared на крон не выдать', () => {
    const src = svc(
      cron(
        'tickA',
        "if (!(await this.l.claimRun('a'))) return; await this.tickB();",
      ),
      cron(
        'tickB',
        "if (!(await this.l.claimRun('b'))) return; await this.publisher.publish();",
      ),
    );
    const res = run(src, {
      'src/s.service.ts::tickA': LEADER,
      'src/s.service.ts::tickB': LEADER,
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'src/s.service.ts::tickB: метод под арендами двух leader-кронов (tickA, tickB)',
    );
  });

  it('exempt-крон в счёт общих не идёт; протухшая shared-запись — красный', () => {
    const src = svc(
      cron(
        'tickA',
        "if (!(await this.l.claimRun('a'))) return; await this.post(1);",
      ),
      cron('prune', 'await this.post(2);'),
      method('post', 'await this.db.deleteMany();'),
    );
    const base = {
      'src/s.service.ts::tickA': LEADER,
      'src/s.service.ts::prune': {
        status: 'exempt',
        reason: 'deleteMany идемпотентен на любом инстансе',
      },
    };
    expect(run(src, base).status).toBe(0);
    const stale = run(src, {
      ...base,
      'src/s.service.ts::post': {
        status: 'shared',
        reason: 'было общим у двух leader-кронов',
      },
    });
    expect(stale.stderr).toContain('shared-запись протухла');
  });

  it('вызов не через this (импортированная функция с тем же именем) общим не считается', () => {
    const src = svc(
      cron(
        'tickA',
        "if (!(await this.l.claimRun('a'))) return; await post(1);",
      ),
      cron(
        'tickB',
        "if (!(await this.l.claimRun('b'))) return; await post(2);",
      ),
      method('post', 'await this.publisher.publish();'),
    );
    const res = run(src, {
      'src/s.service.ts::tickA': LEADER,
      'src/s.service.ts::tickB': LEADER,
    });
    expect(res.status).toBe(0);
  });

  it('модуль правил: слова-отписки в причине — тот же список, что раньше жил в движке', () => {
    expect(
      loadStringList('check-cron-leader-rules.mjs', 'REASON_RED_FLAGS'),
    ).toEqual(['legacy', 'todo', 'потом', 'позже']);
  });
});
