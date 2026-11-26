import { sanitizeMeta } from './analytics-meta.sanitize';

describe('sanitizeMeta: путь клиента', () => {
  it('therapy_path_created: id шаблона или empty, лишнее отбрасывается', () => {
    expect(
      sanitizeMeta('therapy_path_created', { template: 'bpd24', name: 'x' }),
    ).toEqual({ template: 'bpd24' });
    expect(sanitizeMeta('therapy_path_created', { template: 'empty' })).toEqual(
      {
        template: 'empty',
      },
    );
    for (const meta of [{ template: 'мой' }, { template: 5 }, {}]) {
      expect(sanitizeMeta('therapy_path_created', meta)).toBeUndefined();
    }
  });

  it('фаза начата/завершена: ключ из шаблонов или custom', () => {
    for (const name of [
      'therapy_path_phase_started',
      'therapy_path_phase_finished',
    ]) {
      expect(sanitizeMeta(name, { phase: 'bonding' })).toEqual({
        phase: 'bonding',
      });
      expect(sanitizeMeta(name, { phase: 'custom', id: 7 })).toEqual({
        phase: 'custom',
      });
      expect(sanitizeMeta(name, { phase: 'Моя фаза' })).toBeUndefined();
      expect(sanitizeMeta(name, {})).toBeUndefined();
    }
  });

  it('therapy_path_draft_built и therapy_plan_session_marked: целое в границах', () => {
    expect(sanitizeMeta('therapy_path_draft_built', { picked: 0 })).toEqual({
      picked: 0,
    });
    expect(
      sanitizeMeta('therapy_path_draft_built', { picked: 51 }),
    ).toBeUndefined();
    expect(sanitizeMeta('therapy_plan_session_marked', { items: 3 })).toEqual({
      items: 3,
    });
    for (const meta of [{ items: 0 }, { items: 1.5 }, { items: '2' }, {}]) {
      expect(sanitizeMeta('therapy_plan_session_marked', meta)).toBeUndefined();
    }
  });

  it('therapy_plan_item_status: inPhase необязателен и только булев', () => {
    expect(
      sanitizeMeta('therapy_plan_item_status', {
        status: 'done',
        inPhase: true,
      }),
    ).toEqual({ status: 'done', inPhase: true });
    expect(
      sanitizeMeta('therapy_plan_item_status', { status: 'done' }),
    ).toEqual({
      status: 'done',
    });
    expect(
      sanitizeMeta('therapy_plan_item_status', {
        status: 'done',
        inPhase: 'да',
      }),
    ).toEqual({ status: 'done' });
  });
});
