// Гейт «у каждой джобы CI есть timeout-minutes» (аудит 2026-10, правило №24).
// До него шесть из девяти джоб ci.yml жили с дефолтом GitHub в 360 минут:
// висящий vitest держал PR полдня. Правила — job-timeouts.ts; здесь оба исхода
// на образцах (с контрольными) и прогон по настоящим файлам .github/workflows.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { jobBlocks } from './workflow-yaml';
import { jobTimeoutViolations } from './job-timeouts';

const DIR = join(process.cwd(), '.github', 'workflows');
const files = readdirSync(DIR).filter((f) => f.endsWith('.yml'));
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');

const wf = (job: string) => `name: X\n\non:\n  push:\n\njobs:\n${job}`;

const WITH_TIMEOUT = `  build:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - run: true
`;

describe('джоба без потолка — красная', () => {
  it('нет timeout-minutes: сообщение называет джобу', () => {
    const text = wf(
      '  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: true\n',
    );
    expect(jobTimeoutViolations(text)).toEqual([
      'build: нет timeout-minutes на уровне джобы',
    ]);
  });

  it('таймаут только у шага (отступ 8) — не таймаут джобы', () => {
    const text = wf(
      '  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: true\n        timeout-minutes: 6\n',
    );
    expect(jobTimeoutViolations(text)).toHaveLength(1);
  });

  it('закомментированный таймаут не считается', () => {
    const text = wf(
      '  build:\n    runs-on: ubuntu-latest\n    # timeout-minutes: 10\n    steps:\n      - run: true\n',
    );
    expect(jobTimeoutViolations(text)).toHaveLength(1);
  });

  it.each(['0', '360', '600', 'abc', '${{ vars.LIMIT }}'])(
    'значение %s вне 1…359',
    (value) => {
      const text = wf(
        `  build:\n    runs-on: ubuntu-latest\n    timeout-minutes: ${value}\n    steps:\n      - run: true\n`,
      );
      expect(jobTimeoutViolations(text)).toHaveLength(1);
    },
  );

  it('выражение с пробелами: сообщение показывает значение, а не «нет таймаута»', () => {
    const text = wf(
      '  build:\n    runs-on: ubuntu-latest\n    timeout-minutes: ${{ vars.LIMIT }}\n    steps:\n      - run: true\n',
    );
    expect(jobTimeoutViolations(text)).toEqual([
      'build: timeout-minutes: ${{ vars.LIMIT }} вне 1…359',
    ]);
  });

  it('ключ джобы с хвостовым комментарием остаётся отдельной джобой', () => {
    const text = wf(
      `${WITH_TIMEOUT}  lint: # проверки\n    runs-on: ubuntu-latest\n    steps:\n      - run: true\n`,
    );
    expect(Object.keys(jobBlocks(text))).toEqual(['build', 'lint']);
    expect(jobTimeoutViolations(text)).toEqual([
      'lint: нет timeout-minutes на уровне джобы',
    ]);
  });

  it('нарушает только одна джоба из двух', () => {
    const text = wf(
      `${WITH_TIMEOUT}  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - run: true\n`,
    );
    expect(jobTimeoutViolations(text)).toEqual([
      'lint: нет timeout-minutes на уровне джобы',
    ]);
  });
});

describe('джоба с потолком — зелёная', () => {
  it('таймаут на уровне джобы', () => {
    expect(jobTimeoutViolations(wf(WITH_TIMEOUT))).toEqual([]);
  });

  it('крайние допустимые значения 1 и 359, комментарий в хвосте строки', () => {
    for (const v of ['1', '359', '15 # страховка']) {
      const text = wf(
        `  build:\n    runs-on: ubuntu-latest\n    timeout-minutes: ${v}\n    steps:\n      - run: true\n`,
      );
      expect(jobTimeoutViolations(text)).toEqual([]);
    }
  });

  it('джоба, вызывающая переиспользуемый воркфлоу, исключена по построению', () => {
    expect(
      jobTimeoutViolations(
        wf('  call:\n    uses: ./.github/workflows/x.yml\n'),
      ),
    ).toEqual([]);
  });

  it('контрольный: такая же джоба с steps: и без таймаута — красная', () => {
    expect(
      jobTimeoutViolations(
        wf(
          '  call:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: ./a\n',
        ),
      ),
    ).toHaveLength(1);
  });

  it('воркфлоу без блока jobs: нарушений нет', () => {
    expect(jobTimeoutViolations('name: X\n')).toEqual([]);
  });
});

describe('настоящие воркфлоу репозитория', () => {
  it('каталог не пуст', () => {
    expect(files.length).toBeGreaterThanOrEqual(5);
  });

  it('ci.yml разобран целиком: девять джоб (иначе разборщик слеп)', () => {
    expect(Object.keys(jobBlocks(read('ci.yml'))).sort()).toEqual([
      'backend',
      'checks',
      'docker',
      'eslint',
      'migrations',
      'miniapp',
      'perf',
      'shared',
      'webapp',
    ]);
  });

  it.each(files)('%s: у каждой джобы есть timeout-minutes', (f) => {
    expect(jobTimeoutViolations(read(f)).map((v) => `${f}:${v}`)).toEqual([]);
  });
});
