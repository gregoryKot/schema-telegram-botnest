// Гейт «alarm видит каждую джобу своего воркфлоу» (правило №24, аудит
// 2026-10). Появился вместе с ночной джобой npm-audit: alarm сообщает только о
// джобах из своего needs, и забытая в списке новая джоба краснела бы в
// Actions, куда никто не заходит. Правила — alarm-needs.ts; здесь оба исхода
// на образцах и прогон по настоящим nightly.yml и prod-smoke.yml.
import { readFileSync } from 'fs';
import { join } from 'path';
import { alarmNeedsGaps, jobNeeds } from './alarm-needs';

const read = (f: string) =>
  readFileSync(join(process.cwd(), '.github', 'workflows', f), 'utf8');

const job = (id: string, extra = '') =>
  `  ${id}:\n${extra}    runs-on: ubuntu-latest\n    timeout-minutes: 5\n    steps:\n      - run: echo\n`;
const wf = (...jobs: string[]) =>
  `name: X\n\non:\n  push:\n\njobs:\n${jobs.join('\n')}`;

describe('гейт: alarm.needs покрывает все джобы воркфлоу', () => {
  describe('образцы', () => {
    it('забытая джоба — missing', () => {
      const text = wf(
        job('a'),
        job('npm-audit'),
        job('alarm', '    needs:\n      - a\n    if: always()\n'),
      );
      expect(alarmNeedsGaps(text)).toEqual({
        missing: ['npm-audit'],
        unknown: [],
      });
    });

    it('контроль: та же джоба в needs — зелёный', () => {
      const text = wf(
        job('a'),
        job('npm-audit'),
        job('alarm', '    needs:\n      - a\n      - npm-audit\n'),
      );
      expect(alarmNeedsGaps(text)).toEqual({ missing: [], unknown: [] });
    });

    it('имя в needs без джобы — unknown', () => {
      const text = wf(job('a'), job('alarm', '    needs: [a, gone]\n'));
      expect(alarmNeedsGaps(text)).toEqual({ missing: [], unknown: ['gone'] });
    });

    it('needs: скаляр, flow-список с кавычками и блочный список', () => {
      expect(jobNeeds('alarm:\n    needs: a\n')).toEqual(['a']);
      expect(jobNeeds('alarm:\n    needs: [\'a\', "b-c"]\n')).toEqual([
        'a',
        'b-c',
      ]);
      expect(
        jobNeeds('alarm:\n    needs:\n      - a\n      - b\n    if: x\n'),
      ).toEqual(['a', 'b']);
      expect(jobNeeds('alarm:\n    runs-on: x\n')).toEqual([]);
    });

    it('воркфлоу без alarm — ошибка, а не «нарушений нет»', () => {
      expect(() => alarmNeedsGaps(wf(job('a')))).toThrow('джобы alarm нет');
    });
  });

  it.each(['nightly.yml', 'prod-smoke.yml'])(
    '%s: alarm ждёт все джобы',
    (f) => {
      expect(alarmNeedsGaps(read(f))).toEqual({ missing: [], unknown: [] });
    },
  );

  it('nightly.yml: ночной npm-audit под alarm', () => {
    expect(jobNeeds(read('nightly.yml').split(/^ {2}alarm:/m)[1])).toContain(
      'npm-audit',
    );
  });
});
