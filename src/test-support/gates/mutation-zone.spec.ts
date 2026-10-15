// Тест гейта check-mutation-zone.mjs — «файл, выделенный из файла мутационной
// зоны, не выпадает из зоны молча».
//
// Инцидент-образец (nightly golden-auth, issue #614, 2026-10): #625 вынес
// redact() из security-log.service.ts в security-log-redact.ts; сервис остался
// в `mutate` Stryker, новый файл — нет, и редакция секретов перед логом/DM
// осталась без мутационного замера. Гейт обязан краснеть на таком файле и
// зеленеть, когда файл в `mutate` или осознанно классифицирован. Контрольные
// образцы (правило №15): похожий, но законный/незаконный случай ведёт себя
// наоборот — файл, нужный не только зоне, не кандидат; запись без причины и
// протухшая запись красные.
import { runGate } from './gate-sandbox';

const GATE = 'check-mutation-zone.mjs';

const service = [
  "import { redact } from './helper';",
  'export class Service { run() { return redact({}); } }',
  '',
].join('\n');
const helper = 'export const redact = (x: unknown) => x;\n';
const config = (mutate: string[]) => JSON.stringify({ mutate });
const GOOD_REASON =
  'Вынесен из service.ts по правилу №10; мутации не измеряются — долг волны.';
const baseline = (entries: Record<string, { reason: string }>) =>
  JSON.stringify(entries);

describe('check-mutation-zone.mjs', () => {
  it('выделенный файл в `mutate` — зелёно, записи в бейслайне не нужно', () => {
    const res = runGate(GATE, {
      'src/service.ts': service,
      'src/helper.ts': helper,
      'stryker.a.config.json': config(['src/service.ts', 'src/helper.ts']),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('✓ гейт мутационной зоны');
  });

  it('выделенный файл вне `mutate` и без записи — красно, файл назван', () => {
    const res = runGate(GATE, {
      'src/service.ts': service,
      'src/helper.ts': helper,
      'stryker.a.config.json': config(['src/service.ts']),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/helper.ts');
    expect(res.stderr).toContain('не классифицирован');
  });

  it('выделенный файл с честной записью в бейслайне — зелёно (долг виден, не скрыт)', () => {
    const res = runGate(GATE, {
      'src/service.ts': service,
      'src/helper.ts': helper,
      'stryker.a.config.json': config(['src/service.ts']),
      'scripts/mutation-zone-baseline.json': baseline({
        'src/helper.ts': { reason: GOOD_REASON },
      }),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('1 выделенных вне неё классифицировано');
  });

  it('зона — объединение `mutate` всех конфигов, а не одного', () => {
    const res = runGate(GATE, {
      'src/service.ts': service,
      'src/helper.ts': helper,
      'stryker.a.config.json': config(['src/service.ts']),
      'stryker.b.config.json': config(['src/helper.ts']),
    });
    expect(res.status).toBe(0);
  });

  it('импорт из спека не делает файл «нужным не только зоне»', () => {
    const res = runGate(GATE, {
      'src/service.ts': service,
      'src/helper.ts': helper,
      'src/helper.spec.ts': "import { redact } from './helper';\n",
      'stryker.a.config.json': config(['src/service.ts']),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/helper.ts');
  });

  it('контроль: файл, нужный и коду вне зоны, — не кандидат, записи не требует', () => {
    const res = runGate(GATE, {
      'src/service.ts': service,
      'src/helper.ts': helper,
      'src/other.ts': "import { redact } from './helper';\nredact({});\n",
      'stryker.a.config.json': config(['src/service.ts']),
    });
    expect(res.status).toBe(0);
  });

  it.each([
    ['пустая', ''],
    ['короткая', 'потому что'],
    ['отписка', 'legacy, потом разберёмся с этим файлом'],
  ])('запись с причиной «%s» — красно', (_name, reason) => {
    const res = runGate(GATE, {
      'src/service.ts': service,
      'src/helper.ts': helper,
      'stryker.a.config.json': config(['src/service.ts']),
      'scripts/mutation-zone-baseline.json': baseline({
        'src/helper.ts': { reason },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/helper.ts: запись в бейслайне');
  });

  it('протухшая запись (файл вошёл в `mutate`) — красно', () => {
    const res = runGate(GATE, {
      'src/service.ts': service,
      'src/helper.ts': helper,
      'stryker.a.config.json': config(['src/service.ts', 'src/helper.ts']),
      'scripts/mutation-zone-baseline.json': baseline({
        'src/helper.ts': { reason: GOOD_REASON },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухшая запись src/helper.ts');
  });

  it('протухшая запись (файла больше нет) — красно', () => {
    const res = runGate(GATE, {
      'src/service.ts': 'export class Service {}\n',
      'stryker.a.config.json': config(['src/service.ts']),
      'scripts/mutation-zone-baseline.json': baseline({
        'src/gone.ts': { reason: GOOD_REASON },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухшая запись src/gone.ts');
  });

  // Файл только из типов: мутировать нечего, запись «мутации не измеряются» про
  // него была бы ложным долгом (правило №15 п.4). Контроль — в соседних тестах:
  // тот же файл с хоть одной рантайм-строкой по-прежнему кандидат.
  const typesOnly = [
    "import type { Kind } from './kind';",
    '',
    '/** Описание. */',
    'export interface Dto {',
    '  kind: Kind;',
    '}',
    'export type Id = string;',
    '',
  ].join('\n');
  const importsTypes = (file: string) =>
    `import type { Dto } from './${file}';\nexport class Service {}\n`;

  it('файл только из типов — не кандидат, записи не требует', () => {
    const res = runGate(GATE, {
      'src/service.ts': importsTypes('dto'),
      'src/dto.ts': typesOnly,
      'stryker.a.config.json': config(['src/service.ts']),
    });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('0 выделенных вне неё классифицировано');
  });

  it.each([
    ['const', 'export const LIMIT = 5;'],
    ['function', 'export function pick(): number { return 1; }'],
    ['enum', 'export enum Mode { A, B }'],
    ['class', 'export class Box {}'],
    ['реэкспорт значения', "export { x } from './x';"],
    ['обычный import', "import { y } from './y';"],
  ])(
    'контроль: тип + рантайм-строка (%s) — по-прежнему кандидат',
    (_n, line) => {
      const res = runGate(GATE, {
        'src/service.ts': importsTypes('dto'),
        'src/dto.ts': `${typesOnly}${line}\n`,
        'stryker.a.config.json': config(['src/service.ts']),
      });
      expect(res.status).toBe(1);
      expect(res.stderr).toContain('src/dto.ts');
    },
  );

  it('запись про файл, ставший файлом только из типов, — протухшая', () => {
    const res = runGate(GATE, {
      'src/service.ts': importsTypes('dto'),
      'src/dto.ts': typesOnly,
      'stryker.a.config.json': config(['src/service.ts']),
      'scripts/mutation-zone-baseline.json': baseline({
        'src/dto.ts': { reason: GOOD_REASON },
      }),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('протухшая запись src/dto.ts');
  });

  it('динамический import("./x") тоже связывает файл с зоной', () => {
    const res = runGate(GATE, {
      'src/service.ts':
        "export const load = () => import('./helper');\nexport class Service {}\n",
      'src/helper.ts': helper,
      'stryker.a.config.json': config(['src/service.ts']),
    });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('src/helper.ts');
  });
});
