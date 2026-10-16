// Пин «устаревший прогон PR отменяется, прогон main — нет» (ci.yml,
// 2026-10-16). Без блока `concurrency` каждый пуш в PR оставлял прогон прежнего
// коммита жить до конца: в очереди раннеров стояло 12 прогонов, 4 из них — для
// уже заменённых коммитов. Правило без механизма не работает, поэтому форма
// блока закреплена здесь; меняешь формулу — меняй и пин.
//
// Две стороны, и красной должна быть каждая:
//  - нет отмены вообще (нет блока, `false`) — очередь снова забьётся;
//  - отмена безусловная (`true`) или группа общая на ветку — под нож идёт
//    прогон main, то есть коммит без CI и без деплоя. С общей группой GitHub
//    держит один идущий и один ожидающий прогон, а следующий ожидающий молча
//    сбрасывает, даже при `cancel-in-progress: false`.
// yaml-парсера в зависимостях нет: блок плоский, разбирается строками, как в
// deploy-needs-ci.ts.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { stripComments, triggerBlocks } from './deploy-needs-ci';

const DIR = join(process.cwd(), '.github', 'workflows');
const PR_EVENTS = ['pull_request', 'pull_request_target'];

const PR_CANCEL = /github\.event_name\s*==\s*'pull_request'/;
const SHARED_REF = /github\.(?:ref|ref_name|sha)\b/;

/** Тело top-level `concurrency:` (job-level с отступом не считается). */
function concurrencyBody(text: string): string | null {
  const lines = stripComments(text).split('\n');
  const start = lines.findIndex((l) => /^concurrency:/.test(l));
  if (start < 0) return null;
  const body = [lines[start].replace(/^concurrency:/, '')];
  for (const l of lines.slice(start + 1)) {
    if (l.trim() && !/^\s/.test(l)) break;
    body.push(l);
  }
  return body.join('\n');
}

const field = (body: string, key: string): string | null =>
  new RegExp(`^\\s*${key}:\\s*(.*)$`, 'm').exec(body)?.[1].trim() ?? null;

function concurrencyViolations(text: string): string[] {
  const body = concurrencyBody(text);
  if (body === null) return ['нет блока concurrency на верхнем уровне'];
  const bad: string[] = [];
  const cancel = field(body, 'cancel-in-progress');
  if (cancel === null) {
    bad.push('нет cancel-in-progress: устаревший прогон PR не отменяется');
  } else if (!PR_CANCEL.test(cancel)) {
    bad.push(
      `cancel-in-progress «${cancel}» не зависит от event_name == 'pull_request': ` +
        'либо ничего не отменяется, либо отменяются прогоны main',
    );
  }
  const group = field(body, 'group') ?? '';
  if (!group.includes('github.event.pull_request.number')) {
    bad.push('group без номера PR: PR отменяют друг друга');
  }
  if (!group.includes('github.run_id')) {
    bad.push('group вне PR не уникален (нужен github.run_id)');
  }
  if (SHARED_REF.test(group)) {
    bad.push('group общий на ветку/коммит: ожидающий прогон main сбрасывается');
  }
  return bad;
}

const wf = (concurrency: string) =>
  `name: CI\n\non:\n  push:\n    branches: [main]\n  pull_request:\n\n${concurrency}\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n      - run: true\n`;

const GOOD = [
  'concurrency:',
  '  group: ci-${{ github.workflow }}-${{ github.event.pull_request.number || github.run_id }}',
  "  cancel-in-progress: ${{ github.event_name == 'pull_request' }}",
  '',
].join('\n');

describe('гейт: concurrency в ci.yml', () => {
  describe('настоящие воркфлоу', () => {
    const files = readdirSync(DIR).filter((f) => f.endsWith('.yml'));
    const read = (f: string) => readFileSync(join(DIR, f), 'utf8');
    const prWorkflows = files.filter((f) =>
      PR_EVENTS.some((e) => e in triggerBlocks(read(f))),
    );

    it('ci.yml запускается на pull_request (иначе пин ничего не охраняет)', () => {
      expect(prWorkflows).toContain('ci.yml');
    });

    it.each(prWorkflows)('%s: отмена только для PR, прогон main цел', (f) => {
      expect(concurrencyViolations(read(f))).toEqual([]);
    });
  });

  describe('образцы', () => {
    it('зелёный: отмена по PR, вне PR уникальная группа', () => {
      expect(concurrencyViolations(wf(GOOD))).toEqual([]);
    });

    it('красный: блока нет', () => {
      expect(concurrencyViolations(wf(''))).toEqual([
        expect.stringContaining('нет блока concurrency'),
      ]);
    });

    it('красный: cancel-in-progress: true без условия отменяет и main', () => {
      const bad = concurrencyViolations(
        wf(GOOD.replace(/cancel-in-progress: .*/, 'cancel-in-progress: true')),
      );
      expect(bad).toEqual([
        expect.stringContaining('не зависит от event_name'),
      ]);
    });

    it('красный: cancel-in-progress: false ничего не отменяет', () => {
      const bad = concurrencyViolations(
        wf(GOOD.replace(/cancel-in-progress: .*/, 'cancel-in-progress: false')),
      );
      expect(bad).toEqual([
        expect.stringContaining('не зависит от event_name'),
      ]);
    });

    it('красный: условие наоборот (!= pull_request) отменяет только main', () => {
      const inverted = GOOD.replace('==', '!=');
      expect(concurrencyViolations(wf(inverted))).toEqual([
        expect.stringContaining('не зависит от event_name'),
      ]);
    });

    it('красный: в блоке нет cancel-in-progress', () => {
      const noCancel = GOOD.split('\n').slice(0, 2).join('\n');
      expect(concurrencyViolations(wf(noCancel))).toEqual([
        expect.stringContaining('нет cancel-in-progress'),
      ]);
    });

    it('красный: группа без номера PR, все PR отменяют друг друга', () => {
      const bad = concurrencyViolations(
        wf(GOOD.replace(/group: .*/, 'group: ci-${{ github.run_id }}')),
      );
      expect(bad).toEqual([expect.stringContaining('без номера PR')]);
    });

    it('красный: запасная группа github.ref сбрасывает ожидающий прогон main', () => {
      const group =
        'group: ci-${{ github.event.pull_request.number || github.ref }}';
      const bad = concurrencyViolations(wf(GOOD.replace(/group: .*/, group)));
      expect(bad).toEqual([
        expect.stringContaining('не уникален'),
        expect.stringContaining('общий на ветку'),
      ]);
    });

    it('контроль: блок только в комментарии не засчитывается', () => {
      const commented = GOOD.split('\n')
        .map((l) => `# ${l}`)
        .join('\n');
      expect(concurrencyViolations(wf(commented))).toEqual([
        expect.stringContaining('нет блока concurrency'),
      ]);
    });

    it('контроль: concurrency внутри джобы не заменяет верхний уровень', () => {
      const jobLevel = wf('').replace(
        '  a:\n',
        '  a:\n    concurrency:\n      group: x\n      cancel-in-progress: true\n',
      );
      expect(concurrencyViolations(jobLevel)).toEqual([
        expect.stringContaining('нет блока concurrency'),
      ]);
    });
  });
});
