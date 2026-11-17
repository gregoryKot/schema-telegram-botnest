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
});
