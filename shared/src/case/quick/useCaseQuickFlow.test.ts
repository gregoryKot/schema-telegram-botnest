// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCaseQuickFlow } from './useCaseQuickFlow';
import { saveQuickDraft, loadQuickDraft } from './caseQuickDraft';
import { INITIAL_QUICK_FIELDS } from './caseQuick';

beforeEach(() => localStorage.clear());

function setup(
  over: { onSave?: () => Promise<void>; onSaveCard?: () => Promise<void> } = {},
) {
  const props = {
    onSave: vi.fn(over.onSave ?? (() => Promise.resolve())),
    onSaveCard: vi.fn(over.onSaveCard ?? (() => Promise.resolve())),
    onClose: vi.fn(),
  };
  const deps = { trackEvent: vi.fn() };
  const view = renderHook(() => useCaseQuickFlow(props, deps));
  return { ...view, props, deps };
}

/** Доходит до итога: сцена, ворота «Страшно», порыв «Свернуть разговор». */
function toResult(h: ReturnType<typeof setup>) {
  act(() => h.result.current.patch({ scene: 'Тишина в ответ' }));
  act(() => h.result.current.sceneNext());
  act(() => h.result.current.pickGate('fear'));
  act(() => h.result.current.feelNext());
  act(() => h.result.current.toggleImpulseChip('impulse_close'));
  act(() => h.result.current.impulseNext());
}

describe('useCaseQuickFlow — путь целиком', () => {
  it('case_started один раз, case_scene own, затем итог с предложенным режимом', () => {
    const h = setup();
    toResult(h);
    expect(h.result.current.step).toBe('result');
    expect(h.result.current.result?.modeId).toBe('avoidant_protector');
    const names = h.deps.trackEvent.mock.calls.map((c) => c[0]);
    expect(names.filter((n) => n === 'case_started')).toHaveLength(1);
    expect(h.deps.trackEvent).toHaveBeenCalledWith('case_scene', {
      source: 'own',
    });
  });

  it('«Сохранить»: запись с fromCase, карточка режима, case_recognized agreed, case_finished, done', async () => {
    const h = setup();
    toResult(h);
    await act(() => h.result.current.save());
    expect(h.props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        modeId: 'avoidant_protector',
        situation: 'Тишина в ответ',
        fromCase: true,
      }),
    );
    expect(h.props.onSaveCard).toHaveBeenCalledWith(
      expect.objectContaining({ modeId: 'avoidant_protector' }),
    );
    expect(h.deps.trackEvent).toHaveBeenCalledWith('case_recognized', {
      modeId: 'avoidant_protector',
      agreed: true,
    });
    expect(h.deps.trackEvent).toHaveBeenCalledWith('case_finished', {
      modeId: 'avoidant_protector',
    });
    expect(h.result.current.step).toBe('done');
    expect(h.result.current.doneName).toBe('Избегающий Защитник');
    expect(loadQuickDraft()).toBeNull();
  });

  it('«Не похоже»: другой режим → итог пересобран, case_recognized agreed=false', async () => {
    const h = setup();
    toResult(h);
    act(() => h.result.current.openModes());
    expect(h.result.current.step).toBe('modes');
    act(() => h.result.current.pickMode('vulnerable_child'));
    expect(h.result.current.step).toBe('result');
    expect(h.result.current.result?.modeId).toBe('vulnerable_child');
    await act(() => h.result.current.save());
    expect(h.props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ modeId: 'vulnerable_child' }),
    );
    expect(h.deps.trackEvent).toHaveBeenCalledWith('case_recognized', {
      modeId: 'vulnerable_child',
      agreed: false,
    });
  });

  it('смена порывов после выбора режима руками возвращает предложенный', () => {
    const h = setup();
    toResult(h);
    act(() => h.result.current.pickMode('vulnerable_child'));
    act(() => h.result.current.back());
    act(() => h.result.current.toggleImpulseChip('impulse_sharp'));
    act(() => h.result.current.impulseNext());
    expect(h.result.current.fields.modeId).toBe('');
  });
});

describe('useCaseQuickFlow — ошибка сохранения', () => {
  it('запись не сохранилась: остаёмся на итоге, saveFailed, черновик цел, карточка не пишется', async () => {
    const h = setup({ onSave: () => Promise.reject(new Error('net')) });
    toResult(h);
    await act(() => h.result.current.save());
    expect(h.result.current.step).toBe('result');
    expect(h.result.current.saveFailed).toBe(true);
    expect(h.result.current.saving).toBe(false);
    expect(h.props.onSaveCard).not.toHaveBeenCalled();
    expect(h.deps.trackEvent).not.toHaveBeenCalledWith(
      'case_finished',
      expect.anything(),
    );
    expect(loadQuickDraft()?.scene).toBe('Тишина в ответ');
  });

  it('карточка режима не сохранилась после записи: всё равно «Записано»', async () => {
    const h = setup({ onSaveCard: () => Promise.reject(new Error('net')) });
    toResult(h);
    await act(() => h.result.current.save());
    expect(h.result.current.step).toBe('done');
    expect(h.result.current.saveFailed).toBe(false);
  });
});

describe('useCaseQuickFlow — ровный день', () => {
  it('ворота «спокойно» ведут на steady; «Записать так» пишет Здорового Взрослого без карточки', async () => {
    const h = setup();
    act(() => h.result.current.patch({ scene: 'Тихий вечер' }));
    act(() => h.result.current.sceneNext());
    act(() => h.result.current.pickGate('ok'));
    expect(h.result.current.step).toBe('steady');
    await act(() => h.result.current.saveSteady());
    expect(h.props.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ modeId: 'healthy_adult', fromCase: true }),
    );
    expect(h.props.onSaveCard).not.toHaveBeenCalled();
    expect(h.result.current.step).toBe('done');
  });

  it('«Назад» с steady снимает выбор ворот и возвращает на feel', () => {
    const h = setup();
    act(() => h.result.current.patch({ scene: 'Тихий вечер' }));
    act(() => h.result.current.sceneNext());
    act(() => h.result.current.pickGate('ok'));
    act(() => h.result.current.back());
    expect(h.result.current.step).toBe('feel');
    expect(h.result.current.fields.gateId).toBeNull();
  });
});

describe('useCaseQuickFlow — «Своё…» и ворота', () => {
  it('непустой bodyOwn добавляет own-id ворот, пустой убирает; смена ворот переносит его', () => {
    const h = setup();
    act(() => h.result.current.pickGate('fear'));
    act(() => h.result.current.patch({ bodyOwn: 'сжало горло' }));
    expect(h.result.current.fields.bodyChipIds).toEqual(['fear_own']);
    act(() => h.result.current.pickGate('sad'));
    expect(h.result.current.fields.bodyChipIds).toEqual(['sad_own']);
    act(() => h.result.current.patch({ bodyOwn: '' }));
    expect(h.result.current.fields.bodyChipIds).toEqual([]);
  });

  it('impulseOwn синхронизируется с impulse_own; лимиты: тело 2, порывы 3', () => {
    const h = setup();
    act(() => h.result.current.pickGate('fear'));
    act(() => h.result.current.patch({ impulseOwn: 'уехать' }));
    expect(h.result.current.fields.impulseChipIds).toEqual(['impulse_own']);
    const body = h.result.current.bodyChips.filter(
      (c) => !c.id.endsWith('_own'),
    );
    for (const c of body.slice(0, 3))
      act(() => h.result.current.toggleBodyChip(c.id));
    expect(h.result.current.fields.bodyChipIds).toHaveLength(2);
    for (const id of ['impulse_close', 'impulse_phone', 'impulse_sharp'])
      act(() => h.result.current.toggleImpulseChip(id));
    expect(
      h.result.current.fields.impulseChipIds.filter((i) => !i.endsWith('_own')),
    ).toHaveLength(3);
  });

  it('кризисный текст в сцене или «своём» включает crisis', () => {
    const h = setup();
    act(() => h.result.current.patch({ scene: 'не хочу жить' }));
    expect(h.result.current.crisis).toBe(true);
  });

  it('кризисный текст оставляет след для моста к терапевту; обычный — нет', () => {
    const h = setup();
    act(() => h.result.current.patch({ scene: 'Тишина в ответ' }));
    expect(localStorage.getItem('therapy_crisis_seen_at')).toBeNull();
    act(() => h.result.current.patch({ scene: 'не хочу жить' }));
    expect(localStorage.getItem('therapy_crisis_seen_at')).not.toBeNull();
  });
});

describe('useCaseQuickFlow — черновик', () => {
  it('черновик на итоге возобновляется на итоге', () => {
    saveQuickDraft({
      ...INITIAL_QUICK_FIELDS,
      step: 'result',
      scene: 'сцена',
      gateId: 'fear',
      impulseChipIds: ['impulse_close'],
    });
    const h = setup();
    expect(h.result.current.step).toBe('result');
    expect(h.result.current.result?.modeId).toBe('avoidant_protector');
  });

  it.each(['modes', 'done'] as const)(
    'черновик на «%s» откатывается на итог',
    (step) => {
      saveQuickDraft({
        ...INITIAL_QUICK_FIELDS,
        step,
        scene: 'с',
        gateId: 'fear',
      });
      expect(setup().result.current.step).toBe('result');
    },
  );

  it('черновик steady/ворот «спокойно» — на feel без выбранных ворот', () => {
    saveQuickDraft({
      ...INITIAL_QUICK_FIELDS,
      step: 'steady',
      scene: 'с',
      gateId: 'ok',
    });
    const h = setup();
    expect(h.result.current.step).toBe('feel');
    expect(h.result.current.fields.gateId).toBeNull();
  });

  it('итог без ворот в черновике (битый) — на feel', () => {
    saveQuickDraft({ ...INITIAL_QUICK_FIELDS, step: 'result', scene: 'с' });
    expect(setup().result.current.step).toBe('feel');
  });

  it('сцена пишется в черновик, пустой поток — нет', () => {
    const h = setup();
    expect(loadQuickDraft()).toBeNull();
    act(() => h.result.current.patch({ scene: 'начал' }));
    expect(loadQuickDraft()?.scene).toBe('начал');
  });

  it('«Назад» на первом шаге закрывает поток', () => {
    const h = setup();
    act(() => h.result.current.back());
    expect(h.props.onClose).toHaveBeenCalledTimes(1);
  });
});
