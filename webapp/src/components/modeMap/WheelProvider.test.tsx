// @vitest-environment jsdom
// Колесо потребностей клиента на холсте: данные из концептуализации, правка видна сразу,
// на сервер уходит колесо целиком после паузы (одно колесо на клиента, его же видит «Схема»).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { WheelProvider, WHEEL_SAVE_DELAY_MS } from './WheelProvider';
import { useWheel, type WheelState } from './wheelContext';
import { ConceptSyncContext, type ConceptSyncState } from './conceptSyncContext';
import type { ClientConceptState } from './clientConceptContext';
import type { ConceptNeedLink } from '../../../../shared/src/therapy/conceptGraph/needLinks';
import { CONCEPT_NEEDS_RATED_EVENT } from '../../../../shared/src/share/analytics';

const saveConceptNeeds = vi.fn();
const trackEvent = vi.fn();
vi.mock('../../api', () => ({
  api: { saveConceptNeeds: (...a: unknown[]) => saveConceptNeeds(...a), trackEvent: (...a: unknown[]) => trackEvent(...a) },
  reportClientError: vi.fn(),
}));

const A: ConceptNeedLink[] = [{ needId: 'play', ratings: { now: 3 }, notes: {} }];
const B: ConceptNeedLink[] = [{ needId: 'play', ratings: { now: 7 }, notes: {} }];
const concept = (needLinks: ConceptNeedLink[]): ClientConceptState => ({ schemaIds: [], modeIds: [], modeLinks: [], schemaLinks: [], needLinks });

function setup(state: ClientConceptState, clientId: number | null = 7) {
  let seen: WheelState | null = null;
  const replaceConcept = vi.fn();
  const sync = { concept: state, replaceConcept } as unknown as ConceptSyncState;
  const Probe = () => { seen = useWheel(); return null; };
  const { unmount } = render(<ConceptSyncContext.Provider value={sync}><WheelProvider clientId={clientId}><Probe /></WheelProvider></ConceptSyncContext.Provider>);
  return { wheel: () => seen!, replaceConcept, unmount };
}
const flush = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(WHEEL_SAVE_DELAY_MS + 10); }); };

beforeEach(() => { vi.useFakeTimers(); saveConceptNeeds.mockReset(); trackEvent.mockReset(); });
afterEach(() => { vi.useRealTimers(); });

describe('WheelProvider', () => {
  it('колесо — из концептуализации; пока она грузится — null, не загрузилась — failed (не «пусто»)', () => {
    expect(setup(concept(A)).wheel().links).toEqual(A);
    expect(setup(null).wheel()).toMatchObject({ links: null, failed: false });
    expect(setup('failed').wheel()).toMatchObject({ links: null, failed: true });
  });

  it('правка видна сразу, на сервер уходит колесо целиком после паузы; ответ заменяет концептуализацию холста', async () => {
    saveConceptNeeds.mockResolvedValue({ needLinks: B });
    const { wheel, replaceConcept } = setup(concept(A));
    act(() => wheel().save(B));
    expect(wheel().links).toEqual(B);
    expect(saveConceptNeeds).not.toHaveBeenCalled();
    await flush();
    expect(saveConceptNeeds).toHaveBeenCalledTimes(1);
    expect(saveConceptNeeds).toHaveBeenCalledWith(7, B);
    expect(replaceConcept).toHaveBeenCalledWith({ needLinks: B });
    expect(wheel().status).toBe('idle');
  });

  it('серия правок (протяжка ползунка) — один запрос с последним колесом', async () => {
    saveConceptNeeds.mockResolvedValue({ needLinks: B });
    const { wheel } = setup(concept([]));
    act(() => wheel().save(A));
    act(() => wheel().save(B));
    await flush();
    expect(saveConceptNeeds).toHaveBeenCalledTimes(1);
    expect(saveConceptNeeds).toHaveBeenCalledWith(7, B);
  });

  it('сбой не теряет правку: она остаётся на экране, «Повторить» шлёт её снова', async () => {
    saveConceptNeeds.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ needLinks: B });
    const { wheel } = setup(concept(A));
    act(() => wheel().save(B));
    await flush();
    expect(wheel().status).toBe('failed');
    expect(wheel().links).toEqual(B);
    act(() => wheel().retry());
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(saveConceptNeeds).toHaveBeenCalledTimes(2);
    expect(wheel().status).toBe('idle');
  });

  it('без клиента колесо не пишется', async () => {
    const { wheel } = setup(concept([]), null);
    act(() => wheel().save(B));
    await flush();
    expect(saveConceptNeeds).not.toHaveBeenCalled();
  });
});

// Правило №8: «терапевт поставил оценку или текст на колесе, и колесо сохранилось» — одно событие
// на открытие холста. Автосохранение идёт на каждую правку, а перенос старых оценок из карты
// (useWheelLegacyMove, { auto: true }) — не действие человека.
describe('WheelProvider — событие concept_needs_rated', () => {
  const settle = async () => { await act(async () => { await vi.advanceTimersByTimeAsync(0); }); };

  it('первое успешное сохранение шлёт событие, следующие за то же открытие холста — нет', async () => {
    saveConceptNeeds.mockResolvedValue({ needLinks: B });
    const { wheel } = setup(concept([]));
    act(() => wheel().save(A));
    expect(trackEvent).not.toHaveBeenCalled(); // правка на экране — ещё не сохранение
    await flush();
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('concept_needs_rated'); // без meta: ни клиента, ни текстов
    expect(CONCEPT_NEEDS_RATED_EVENT).toBe('concept_needs_rated'); // литерал в провайдере видит трипваер analytics-sync
    act(() => wheel().save(B));
    await flush();
    expect(saveConceptNeeds).toHaveBeenCalledTimes(2);
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('сбой сохранения события не шлёт; «Повторить» сохранил ту же правку — событие ушло', async () => {
    saveConceptNeeds.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ needLinks: B });
    const { wheel } = setup(concept(A));
    act(() => wheel().save(B));
    await flush();
    expect(wheel().status).toBe('failed');
    expect(trackEvent).not.toHaveBeenCalled();
    act(() => wheel().retry());
    await settle();
    expect(wheel().status).toBe('idle');
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('автоперенос события не шлёт и открытие не «тратит»: правка человека после него — шлёт', async () => {
    saveConceptNeeds.mockResolvedValue({ needLinks: A });
    const { wheel } = setup(concept([]));
    act(() => wheel().save(A, { auto: true }));
    await flush();
    expect(saveConceptNeeds).toHaveBeenCalledTimes(1);
    expect(trackEvent).not.toHaveBeenCalled();
    act(() => wheel().save(B));
    await flush();
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('сбой автопереноса и «Повторить» события не шлют: человек колесо не правил', async () => {
    saveConceptNeeds.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ needLinks: A });
    const { wheel } = setup(concept([]));
    act(() => wheel().save(A, { auto: true }));
    await flush();
    act(() => wheel().retry());
    await settle();
    expect(saveConceptNeeds).toHaveBeenCalledTimes(2);
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('правка человека в одной паузе с автопереносом (до него или после) — сохранение считается его', async () => {
    saveConceptNeeds.mockResolvedValue({ needLinks: B });
    const first = setup(concept([]));
    act(() => first.wheel().save(A, { auto: true }));
    act(() => first.wheel().save(B));
    await flush();
    expect(saveConceptNeeds).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledTimes(1);
    first.unmount();
    trackEvent.mockReset();
    const second = setup(concept([]));
    act(() => second.wheel().save(A));
    act(() => second.wheel().save(B, { auto: true }));
    await flush();
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('правка, сделанная пока идёт запрос автопереноса, ждёт своего ответа', async () => {
    let answer!: (saved: { needLinks: ConceptNeedLink[] }) => void;
    saveConceptNeeds
      .mockReturnValueOnce(new Promise((resolve) => { answer = resolve; }))
      .mockResolvedValue({ needLinks: B });
    const { wheel } = setup(concept([]));
    act(() => wheel().save(A, { auto: true }));
    await flush(); // запрос автопереноса ушёл и ещё не ответил
    act(() => wheel().save(B));
    answer({ needLinks: A });
    await settle();
    expect(trackEvent).not.toHaveBeenCalled(); // сохранился автоперенос, правка человека ещё в паузе
    await flush();
    expect(saveConceptNeeds).toHaveBeenCalledTimes(2);
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('холст закрыли в паузе после правки: досылка сохранила — событие ушло; досылка автопереноса — нет', async () => {
    saveConceptNeeds.mockResolvedValue({ needLinks: B });
    const human = setup(concept([]));
    act(() => human.wheel().save(B));
    human.unmount();
    await settle();
    expect(saveConceptNeeds).toHaveBeenCalledWith(7, B, { keepalive: true });
    expect(trackEvent).toHaveBeenCalledTimes(1);
    trackEvent.mockReset();
    const auto = setup(concept([]));
    act(() => auto.wheel().save(A, { auto: true }));
    auto.unmount();
    await settle();
    expect(saveConceptNeeds).toHaveBeenCalledWith(7, A, { keepalive: true });
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('новое открытие холста — новое событие', async () => {
    saveConceptNeeds.mockResolvedValue({ needLinks: B });
    const first = setup(concept([]));
    act(() => first.wheel().save(B));
    await flush();
    first.unmount();
    const second = setup(concept([]));
    act(() => second.wheel().save(A));
    await flush();
    expect(trackEvent).toHaveBeenCalledTimes(2);
  });
});
