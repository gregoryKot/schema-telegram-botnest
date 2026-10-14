// Гейт «деплой ждёт CI» (quality#35, аудит 2026-10): воркфлоу, который ходит
// на боевой сервер, не имеет права стартовать от push. Раньше deploy-vps.yml
// слушал `push: [main]` и шёл параллельно с CI — красный merge-коммит успевал
// уехать на прод. Правила — deploy-needs-ci.ts; здесь оба исхода на образцах
// и прогон по настоящим файлам .github/workflows.
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import {
  deployViolations,
  isDeployWorkflow,
  jobConditions,
  triggerBlocks,
} from './deploy-needs-ci';

const DIR = join(process.cwd(), '.github', 'workflows');
const files = readdirSync(DIR).filter((f) => f.endsWith('.yml'));
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');
const CI_NAME = /^name:\s*(.+)$/m.exec(read('ci.yml'))![1].trim();

const COND_OK = `    if: >-
      (github.event_name == 'workflow_run'
      && github.event.workflow_run.conclusion == 'success'
      && github.event.workflow_run.head_branch == 'main'
      && github.event.workflow_run.event == 'push')
      || (github.event_name == 'workflow_dispatch'
      && github.ref == 'refs/heads/main')`;

const wf = (on: string, ifLine = COND_OK, step = 'ssh vps true') =>
  `name: Деплой\n\non:\n${on}\n\njobs:\n  deploy:\n${ifLine}\n    runs-on: ubuntu-latest\n    steps:\n      - run: ${step}\n`;

const ON_RUN = `  workflow_run:
    workflows: [${CI_NAME}]
    types: [completed]
    branches: [main]
  workflow_dispatch:`;

// Триггер и условие deploy-vps.yml ДО починки (коммит 01892e92).
const ON_PUSH = '  push:\n    branches: [main]\n  workflow_dispatch:';
const COND_OLD = "    if: github.ref == 'refs/heads/main'";

describe('гейт: деплой ждёт CI', () => {
  describe('красные образцы', () => {
    it('deploy-vps.yml до правки (on: push) краснеет', () => {
      const bad = deployViolations(wf(ON_PUSH, COND_OLD), CI_NAME);
      expect(bad).toEqual([expect.stringContaining('триггер «push» запрещён')]);
    });

    it('pull_request и schedule на воркфлоу с деплоем тоже запрещены', () => {
      for (const ev of ['pull_request', 'schedule']) {
        const bad = deployViolations(wf(`${ON_RUN}\n  ${ev}:`), CI_NAME);
        expect(bad).toEqual([expect.stringContaining(`«${ev}»`)]);
      }
    });

    it('workflow_run без проверки conclusion == success краснеет', () => {
      const cond = COND_OK.replace(
        "&& github.event.workflow_run.conclusion == 'success'\n",
        '',
      );
      const bad = deployViolations(wf(ON_RUN, cond), CI_NAME);
      expect(bad).toEqual([expect.stringContaining("conclusion == 'success'")]);
    });

    it('workflow_run без head_branch и event краснеет (PR из форка с веткой main)', () => {
      const cond = `    if: github.event.workflow_run.conclusion == 'success' || github.ref == 'refs/heads/main'`;
      const bad = deployViolations(wf(ON_RUN, cond), CI_NAME);
      expect(bad).toEqual([
        expect.stringContaining("head_branch == 'main'"),
        expect.stringContaining("event == 'push'"),
      ]);
    });

    it('workflow_run на чужой воркфлоу, а не на CI, краснеет', () => {
      const on = ON_RUN.replace(`[${CI_NAME}]`, '[Nightly]');
      const bad = deployViolations(wf(on), CI_NAME);
      expect(bad).toEqual([expect.stringContaining(`«${CI_NAME}»`)]);
    });

    it('github.sha в workflow_run-деплое краснеет, head_sha с запасным github.sha — нет', () => {
      const naive = wf(ON_RUN, COND_OK, 'ssh vps "deploy $GITHUB_SHA"');
      expect(deployViolations(naive, CI_NAME)).toEqual([
        expect.stringContaining('head_sha'),
      ]);
      const fixed = wf(
        ON_RUN,
        COND_OK,
        'echo ${{ github.event.workflow_run.head_sha || github.sha }} && ssh vps true',
      );
      expect(deployViolations(fixed, CI_NAME)).toEqual([]);
    });

    it('только ручной запуск без защиты ref == main краснеет', () => {
      const bad = deployViolations(
        wf('  workflow_dispatch:', '    if: true'),
        CI_NAME,
      );
      expect(bad).toEqual([expect.stringContaining('ref == main')]);
    });

    it('триггер списком (on: [push]) тоже виден', () => {
      const text =
        'name: X\non: [push, workflow_dispatch]\njobs:\n  d:\n    if: true\n';
      expect(Object.keys(triggerBlocks(text))).toEqual([
        'push',
        'workflow_dispatch',
      ]);
    });
  });

  describe('зелёные и контрольные образцы', () => {
    it('workflow_run на CI с полным условием — чисто', () => {
      expect(deployViolations(wf(ON_RUN), CI_NAME)).toEqual([]);
    });

    it('ручной деплой с защитой ref == main — чисто', () => {
      const cond = "    if: github.ref == 'refs/heads/main'";
      expect(
        deployViolations(wf('  workflow_dispatch:', cond), CI_NAME),
      ).toEqual([]);
    });

    it('контроль: воркфлоу без деплоя с on: push не считается деплоем', () => {
      const text = wf(ON_PUSH, COND_OLD, 'npm test');
      expect(isDeployWorkflow(text)).toBe(false);
    });

    it('контроль: упоминание ssh в комментарии — не деплой', () => {
      expect(
        isDeployWorkflow(wf(ON_PUSH, COND_OLD, 'npm test\n      # ssh vps')),
      ).toBe(false);
    });

    it('условие джобы склеивается из многострочного >-', () => {
      expect(jobConditions(wf(ON_RUN)).deploy).toContain(
        "workflow_run.conclusion == 'success' && github.event.workflow_run.head_branch",
      );
    });
  });

  describe('настоящие воркфлоу репозитория', () => {
    const deploys = files.filter((f) => isDeployWorkflow(read(f)));

    it('деплой-воркфлоу найдены (иначе гейт вхолостую)', () => {
      expect(deploys).toEqual(
        expect.arrayContaining(['deploy-vps.yml', 'vps.yml']),
      );
    });

    it.each(deploys)('%s: без нарушений', (f) => {
      expect(deployViolations(read(f), CI_NAME)).toEqual([]);
    });

    it('deploy-vps.yml слушает именно CI и ловит завершение', () => {
      const run = triggerBlocks(read('deploy-vps.yml')).workflow_run;
      expect(run).toContain(`workflows: [${CI_NAME}]`);
      expect(run).toContain('types: [completed]');
    });

    it('воркфлоу без деплоя (ci, nightly, prod-smoke) гейт не трогает', () => {
      for (const f of ['ci.yml', 'nightly.yml', 'prod-smoke.yml']) {
        expect(isDeployWorkflow(read(f))).toBe(false);
      }
    });
  });
});
