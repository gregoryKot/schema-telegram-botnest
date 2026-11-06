// @vitest-environment jsdom
// Строка связи холста с концептуализацией (#963): каждое состояние и кнопки.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ConceptSyncLine } from './ConceptSyncLine';
import { ConceptSyncContext, type ConceptSyncState } from './conceptSyncContext';
import { listNames } from './conceptSyncText';

const trackEvent = vi.fn();
vi.mock('../../api', () => ({ api: { trackEvent: (...a: unknown[]) => trackEvent(...a) } }));

const LOADED = { schemaIds: [], modeIds: [], modeLinks: [] };
const NONE = { modeIds: [], schemaIds: [] };
function state(over: Partial<ConceptSyncState> = {}): ConceptSyncState {
  return {
    active: true, couple: false, concept: LOADED, missing: NONE, status: 'idle', lastAdded: null,
    retry: vi.fn(), markToMap: vi.fn(), replaceConcept: vi.fn(), ...over,
  };
}
const generate = vi.fn();
function renderLine(s: ConceptSyncState | null) {
  return render(<ConceptSyncContext.Provider value={s}><ConceptSyncLine onAddToMap={generate} /></ConceptSyncContext.Provider>);
}
const text = (c: HTMLElement) => c.querySelector('.mm2-sync')?.textContent ?? '';

beforeEach(() => { vi.clearAllMocks(); generate.mockResolvedValue(true); });
afterEach(() => cleanup());

describe('ConceptSyncLine — состояния', () => {
  it('вне карты клиента (нет провайдера или клиента) — ничего', () => {
    expect(renderLine(null).container.textContent).toBe('');
    cleanup();
    expect(renderLine(state({ active: false })).container.textContent).toBe('');
  });

  it('концептуализация грузится — скелетон, кнопки «Добавить на карту» нет', () => {
    const { container } = renderLine(state({ concept: null, missing: null }));
    expect(container.querySelector('.mm2-sync .skel')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('не загрузилась', () => {
    renderLine(state({ concept: 'failed', missing: null }));
    expect(screen.getByRole('alert').textContent).toBe('Концептуализация не загрузилась');
  });

  it('карта пары', () => {
    const { container } = renderLine(state({ couple: true, missing: { modeIds: ['demanding_critic'], schemaIds: [] } }));
    expect(text(container)).toBe('Карта пары в концептуализацию не пишет');
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('запись не прошла — «Не записалось…» и «Повторить» зовёт retry', () => {
    const s = state({ status: 'failed', lastAdded: { modeIds: ['demanding_critic'] } });
    renderLine(s);
    expect(screen.getByRole('alert').textContent).toContain('Не записалось в концептуализацию');
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(s.retry).toHaveBeenCalledTimes(1);
  });

  it('в полях есть, на карте нет — человеческие имена и «Добавить на карту»', () => {
    const { container } = renderLine(state({ missing: { modeIds: ['demanding_critic'], schemaIds: ['defectiveness'] } }));
    expect(text(container)).toContain('В концептуализации есть, на карте нет: Требовательный Критик, Дефективность / Стыд');
    expect(screen.getByRole('button', { name: 'Добавить на карту' })).toBeTruthy();
  });

  it('только что записали — «Добавлено в концептуализацию: …», связь — «схема → режим»', () => {
    const { container } = renderLine(state({
      lastAdded: { schemaIds: ['failure'], modeLinks: [{ modeId: 'demanding_critic', schemaIds: ['failure'] }] },
    }));
    expect(text(container)).toBe('Добавлено в концептуализацию: Неуспешность, Неуспешность → Требовательный Критик');
  });

  it('записали и в полях есть недостающее — обе части в одной строке, кнопка остаётся', () => {
    const { container } = renderLine(state({
      lastAdded: { modeIds: ['punitive_critic'] }, missing: { modeIds: ['demanding_critic'], schemaIds: [] },
    }));
    expect(text(container)).toContain('Добавлено в концептуализацию: Карающий Критик. В концептуализации есть, на карте нет: Требовательный Критик');
    expect(screen.getByRole('button', { name: 'Добавить на карту' })).toBeTruthy();
  });

  it('иначе — «Совпадает с концептуализацией»', () => {
    const { container } = renderLine(state());
    expect(text(container)).toBe('Совпадает с концептуализацией');
  });
});

describe('ConceptSyncLine — «Добавить на карту»', () => {
  it('гасит «Добавлено», зовёт тот же generate и шлёт concept_sync_to_map', async () => {
    const s = state({ missing: { modeIds: ['demanding_critic'], schemaIds: [] } });
    renderLine(s);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Добавить на карту' })); });
    expect(s.markToMap).toHaveBeenCalledTimes(1);
    expect(generate).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('concept_sync_to_map');
  });

  it('сборка не удалась — события нет', async () => {
    generate.mockResolvedValue(false);
    renderLine(state({ missing: { modeIds: ['demanding_critic'], schemaIds: [] } }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Добавить на карту' })); });
    expect(trackEvent).not.toHaveBeenCalled();
  });
});

describe('listNames', () => {
  it('больше трёх — «… и ещё N»', () => {
    expect(listNames(['А', 'Б', 'В'])).toBe('А, Б, В');
    expect(listNames(['А', 'Б', 'В', 'Г', 'Д'])).toBe('А, Б, В и ещё 2');
  });
});
