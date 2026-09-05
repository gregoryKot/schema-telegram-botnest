// Тест гейта check-cron-leader.mjs — leader-election для `@Cron(`.
//
// Крон без leader-election дублируется на втором инстансе (второй под,
// перекатывающийся деплой Amvera): два процесса шлют одно и то же
// сообщение дважды. Гейт НЕ ищет признак («похоже на безопасное») — он
// требует явной классификации каждого найденного крона в
// scripts/cron-leader-baseline.json, иначе он был бы слеп к новому крону
// ровно так же, как table-registry.spec.ts был слеп к новой модели, пока её
// не вписали руками в реестр.
//
// Проверяются оба исхода (правило CLAUDE.md: гейт без теста на оба исхода
// не доказывает ничего) плюс контрольный образец (правило №15): похожий, но
// незаконный случай обязан остаться красным.
import { readFileSync } from 'fs';
import { join } from 'path';
import { runGate } from './gate-sandbox';

const REAL_BASELINE = join(
  __dirname,
  '..',
  '..',
  '..',
  'scripts',
  'cron-leader-baseline.json',
);

describe('check-cron-leader.mjs', () => {
  it('чистое дерево: leader с claimRun + exempt с нормальной причиной — exit 0', () => {
    const res = runGate('check-cron-leader.mjs', {
      'src/foo.service.ts': [
        'export class FooService {',
        "  @Cron('*/5 * * * *')",
        '  async tick(): Promise<void> {',
        "    if (!(await this.leader.claimRun('tick'))) return;",
        '    await this.doWork();',
        '  }',
        '}',
        '',
      ].join('\n'),
      'src/bar.service.ts': [
        'export class BarService {',
        "  @Cron('0 * * * *')",
        '  async prune() {',
        '    await this.prisma.thing.deleteMany({ where: { old: true } });',
        '  }',
        '}',
        '',
      ].join('\n'),
      'scripts/cron-leader-baseline.json': JSON.stringify({
        'src/foo.service.ts::tick': {
          status: 'leader',
          reason: 'дублирующий тик шлёт пользователю сообщение дважды',
        },
        'src/bar.service.ts::prune': {
          status: 'exempt',
          reason: 'deleteMany идемпотентен, второй инстанс удалит 0 строк',
        },
      }),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ гейт leader-election кронов');
  });

  it('многострочный декоратор с { name: ... } — метод и claimRun находятся', () => {
    const res = runGate('check-cron-leader.mjs', {
      'src/multi.service.ts': [
        'export class MultiService {',
        '  @Cron(EVERY_HOUR, {',
        "    name: 'multiTick',",
        '  })',
        '  async handleTick(): Promise<void> {',
        "    if (!(await this.leader.claimRun('multiTick'))) return;",
        '    await this.doWork();',
        '  }',
        '}',
        '',
      ].join('\n'),
      'scripts/cron-leader-baseline.json': JSON.stringify({
        'src/multi.service.ts::handleTick': {
          status: 'leader',
          reason: 'многострочный декоратор, дубль шлёт сообщение дважды',
        },
      }),
    });
    expect(res.status).toBe(0);
  });

  it('незаклассифицированный крон — exit 1, ключ в отчёте', () => {
    const res = runGate('check-cron-leader.mjs', {
      'src/foo.service.ts': [
        'export class FooService {',
        "  @Cron('* * * * *')",
        '  async tick() {',
        '    await this.doWork();',
        '  }',
        '}',
        '',
      ].join('\n'),
      'scripts/cron-leader-baseline.json': JSON.stringify({}),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('незаклассифицированные кроны');
    expect(res.stderr).toContain('src/foo.service.ts::tick');
  });

  // Ядро гейта: объявлен leader, но claimRun( в теле нет — тот самый баг,
  // ради которого гейт заведён (крон реально дублируется на двух инстансах).
  it('leader без claimRun( в теле — exit 1', () => {
    const res = runGate('check-cron-leader.mjs', {
      'src/foo.service.ts': [
        'export class FooService {',
        "  @Cron('* * * * *')",
        '  async tick() {',
        '    await this.doWork();',
        '  }',
        '}',
        '',
      ].join('\n'),
      'scripts/cron-leader-baseline.json': JSON.stringify({
        'src/foo.service.ts::tick': {
          status: 'leader',
          reason: 'дублирующий тик шлёт пользователю сообщение дважды',
        },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain(
      'src/foo.service.ts::tick: объявлен leader, но claimRun( в теле метода не найдено',
    );
  });

  // Контрольный образец правила №15: claimRun( есть, но в ДРУГОМ методе того
  // же файла, не в теле кронового метода — гейт обязан всё равно краснеть,
  // а не «раз где-то в файле есть claimRun — сойдёт».
  it('claimRun( есть в файле, но не в теле кронового метода — по-прежнему exit 1', () => {
    const res = runGate('check-cron-leader.mjs', {
      'src/foo.service.ts': [
        'export class FooService {',
        "  @Cron('* * * * *')",
        '  async tick() {',
        '    await this.doWork();',
        '  }',
        '',
        '  async unrelated() {',
        "    await this.leader.claimRun('other');",
        '  }',
        '}',
        '',
      ].join('\n'),
      'scripts/cron-leader-baseline.json': JSON.stringify({
        'src/foo.service.ts::tick': {
          status: 'leader',
          reason: 'дублирующий тик шлёт пользователю сообщение дважды',
        },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('claimRun( в теле метода не найдено');
  });

  it('протухшая запись: крон исчез из кода — exit 1', () => {
    const res = runGate('check-cron-leader.mjs', {
      'src/foo.service.ts': 'export class FooService {}\n',
      'scripts/cron-leader-baseline.json': JSON.stringify({
        'src/foo.service.ts::tick': {
          status: 'leader',
          reason: 'дублирующий тик шлёт пользователю сообщение дважды',
        },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухшие записи бейслайна');
    expect(res.stderr).toContain('src/foo.service.ts::tick');
  });

  it('exempt с причиной-отпиской («legacy») — exit 1', () => {
    const res = runGate('check-cron-leader.mjs', {
      'src/bar.service.ts': [
        'export class BarService {',
        "  @Cron('0 * * * *')",
        '  async prune() {',
        '    await this.prisma.thing.deleteMany({});',
        '  }',
        '}',
        '',
      ].join('\n'),
      'scripts/cron-leader-baseline.json': JSON.stringify({
        'src/bar.service.ts::prune': {
          status: 'exempt',
          reason: 'legacy, не трогаем этот код совсем',
        },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('exempt-причина похожа на отписку');
  });

  it('exempt с причиной короче 20 символов — exit 1', () => {
    const res = runGate('check-cron-leader.mjs', {
      'src/bar.service.ts': [
        'export class BarService {',
        "  @Cron('0 * * * *')",
        '  async prune() {',
        '    await this.prisma.thing.deleteMany({});',
        '  }',
        '}',
        '',
      ].join('\n'),
      'scripts/cron-leader-baseline.json': JSON.stringify({
        'src/bar.service.ts::prune': { status: 'exempt', reason: 'коротко' },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('exempt без внятной причины');
  });

  it('неизвестный status — exit 1', () => {
    const res = runGate('check-cron-leader.mjs', {
      'src/bar.service.ts': [
        'export class BarService {',
        "  @Cron('0 * * * *')",
        '  async prune() {',
        '    await this.prisma.thing.deleteMany({});',
        '  }',
        '}',
        '',
      ].join('\n'),
      'scripts/cron-leader-baseline.json': JSON.stringify({
        'src/bar.service.ts::prune': {
          status: 'maybe',
          reason: 'осознанная причина длиннее двадцати символов',
        },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('неизвестный status «maybe»');
  });

  it('нет бейслайна вовсе — exit 1 с подсказкой', () => {
    const res = runGate('check-cron-leader.mjs', {
      'src/foo.service.ts': "@Cron('* * * * *')\nasync tick() {}\n",
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Нет бейслайна');
  });

  it('*.spec.ts и *.test.ts не сканируются', () => {
    const res = runGate('check-cron-leader.mjs', {
      'src/foo.spec.ts': "@Cron('* * * * *')\nasync tick() {}\n",
      'scripts/cron-leader-baseline.json': JSON.stringify({}),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ гейт leader-election кронов: 0 кронов');
  });

  it('test-support/ не сканируется', () => {
    const res = runGate('check-cron-leader.mjs', {
      'src/test-support/foo.ts': "@Cron('* * * * *')\nasync tick() {}\n",
      'scripts/cron-leader-baseline.json': JSON.stringify({}),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ гейт leader-election кронов: 0 кронов');
  });

  // Комментарии не считаются кодом — упоминание `@Cron(` или `claimRun(` в
  // комментарии не должно ни рождать запись, ни спасать настоящий крон без
  // захвата (то же слепое пятно, что check-silent-catch.mjs закрывал для
  // `.catch(...)` — комментарий-объяснение не должен красить/спасать гейт).
  it('упоминание @Cron( и claimRun( в комментарии не считается', () => {
    const res = runGate('check-cron-leader.mjs', {
      'src/foo.service.ts': [
        '// Раньше был @Cron(...) без leader — теперь есть claimRun(...)',
        'export class FooService {',
        "  @Cron('* * * * *')",
        '  async tick() {',
        '    // claimRun( тут только в комментарии, не в коде',
        '    await this.doWork();',
        '  }',
        '}',
        '',
      ].join('\n'),
      'scripts/cron-leader-baseline.json': JSON.stringify({
        'src/foo.service.ts::tick': {
          status: 'leader',
          reason: 'дублирующий тик шлёт пользователю сообщение дважды',
        },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('claimRun( в теле метода не найдено');
  });
});

// Реестр scripts/cron-leader-baseline.json — держим честным сам по себе (тот
// же принцип, что feature-parity.spec.ts применяет к своему бейслайну):
// каждая запись валидна, ключи отсортированы (правило №13 CLAUDE.md).
describe('scripts/cron-leader-baseline.json соответствует своим правилам', () => {
  it('каждая запись — валидный status и причина не короче 20 символов, ключи отсортированы', () => {
    const baseline = JSON.parse(readFileSync(REAL_BASELINE, 'utf8')) as Record<
      string,
      { status: string; reason: string }
    >;
    const keys = Object.keys(baseline);
    expect(keys).toEqual([...keys].sort());
    for (const [key, v] of Object.entries(baseline)) {
      expect(['leader', 'exempt']).toContain(v.status);
      if (v.reason.trim().length < 20)
        throw new Error(`${key}: reason too short`);
    }
  });
});
