import { sanitizeMeta } from './analytics-meta.sanitize';
import { PLAN_RUBRICS } from '../therapy/therapy-plan.types';

describe('sanitizeMeta: события плана работы', () => {
  it('therapy_plan_item_added: только рубрика из списка и булев fromGuide', () => {
    for (const rubric of PLAN_RUBRICS) {
      expect(
        sanitizeMeta('therapy_plan_item_added', { rubric, fromGuide: true }),
      ).toEqual({ rubric, fromGuide: true });
    }
    expect(
      sanitizeMeta('therapy_plan_item_added', {
        rubric: 'custom',
        fromGuide: false,
        text: 'пункт про маму',
        clientId: 'abc',
      }),
    ).toEqual({ rubric: 'custom', fromGuide: false });
  });

  it('therapy_plan_item_added: чужая рубрика или не булев fromGuide — мимо', () => {
    const bad = [
      { rubric: 'пункт про маму', fromGuide: true },
      { rubric: 'custom', fromGuide: 'true' },
      { rubric: 'custom' },
      { fromGuide: true },
      {},
    ];
    for (const meta of bad) {
      expect(sanitizeMeta('therapy_plan_item_added', meta)).toBeUndefined();
    }
  });

  it('therapy_plan_item_status: только статус из списка', () => {
    expect(
      sanitizeMeta('therapy_plan_item_status', { status: 'done', text: 'x' }),
    ).toEqual({ status: 'done' });
    for (const meta of [{ status: 'archived' }, { status: 1 }, {}]) {
      expect(sanitizeMeta('therapy_plan_item_status', meta)).toBeUndefined();
    }
  });

  it('task_assign_source: только источник из списка, текст задания — мимо', () => {
    for (const source of ['tile', 'catalog', 'custom']) {
      expect(sanitizeMeta('task_assign_source', { source, text: 'x' })).toEqual(
        { source },
      );
    }
    for (const meta of [{ source: 'guide' }, { source: 1 }, {}]) {
      expect(sanitizeMeta('task_assign_source', meta)).toBeUndefined();
    }
  });

  it('search_result_open: вид из списка, «был ли запрос» и «из недавнего»; текст запроса — мимо', () => {
    for (const kind of [
      'client',
      'client_tab',
      'section',
      'guide',
      'task',
      'action',
    ]) {
      expect(
        sanitizeMeta('search_result_open', {
          kind,
          typed: true,
          query: 'покинутость',
        }),
      ).toEqual({ kind, typed: true, recent: false });
    }
    expect(
      sanitizeMeta('search_result_open', {
        kind: 'client',
        typed: false,
        recent: true,
      }),
    ).toEqual({ kind: 'client', typed: false, recent: true });
    for (const meta of [
      { kind: 'article', typed: true },
      { kind: 'guide' },
      { kind: 'guide', typed: 'да' },
      {},
    ]) {
      expect(sanitizeMeta('search_result_open', meta)).toBeUndefined();
    }
  });
});
