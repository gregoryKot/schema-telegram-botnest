// @vitest-environment jsdom
// Строка связи холста с концептуализацией (#963): каждое состояние и кнопки.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { ConceptSyncLine } from './ConceptSyncLine';
import { ConceptSyncContext, type ConceptSyncState } from './conceptSyncContext';
import { listNames } from './conceptSyncText';
import { CONCEPT_SYNC_TO_MAP_EVENT } from '../../../../shared/src/share/analytics';

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

  it('в полях есть, на карте нет — число впереди, человеческие имена и «Добавить на карту»', () => {
    const { container } = renderLine(state({ missing: { modeIds: ['demanding_critic'], schemaIds: ['defectiveness'] } }));
    expect(text(container)).toBe('Нет на карте 2 из концептуализации: Требовательный Критик, Дефективность / СтыдДобавить на карту');
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
    expect(text(container)).toContain('Добавлено в концептуализацию: Карающий Критик. Нет на карте 1 из концептуализации: Требовательный Критик');
    expect(screen.getByRole('button', { name: 'Добавить на карту' })).toBeTruthy();
  });

  it('иначе — «Карта совпадает с концептуализацией»', () => {
    const { container } = renderLine(state());
    expect(text(container)).toBe('Карта совпадает с концептуализацией');
  });
});

// Скриншот владельца 2026-11: на ноутбуке строка наезжала на тулбар и ломалась в три строки.
// Теперь — одна линия в полосе над холстом: короткий текст (CSS режет хвост многоточием),
// число впереди, все имена — в title и по тапу, «Добавить на карту» — отдельной кнопкой справа.
describe('ConceptSyncLine — одна линия над холстом', () => {
  const MANY = { modeIds: ['vulnerable_child', 'demanding_critic', 'punitive_critic', 'angry_child', 'detached_protector'], schemaIds: ['defectiveness', 'failure'] };
  const ALL = 'Уязвимый Ребёнок, Требовательный Критик, Карающий Критик, Сердитый Ребёнок, Отстранённый Защитник, Дефективность / Стыд, Неуспешность';
  const lineText = () => document.querySelector<HTMLElement>('.mm2-sync-text')!;

  it('короткий вид: число, три имени и «и ещё N»; ссылка — отдельная кнопка после текста', () => {
    renderLine(state({ missing: MANY }));
    expect(lineText().textContent).toBe('Нет на карте 7 из концептуализации: Уязвимый Ребёнок, Требовательный Критик, Карающий Критик и ещё 4');
    const add = screen.getByRole('button', { name: 'Добавить на карту' });
    expect(lineText().compareDocumentPosition(add) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('полный список — в title, текст свёрнут', () => {
    renderLine(state({ missing: MANY }));
    expect(lineText().getAttribute('title')).toBe(`Нет на карте 7 из концептуализации: ${ALL}`);
    expect(lineText().getAttribute('aria-expanded')).toBe('false');
    expect(document.querySelector('.mm2-sync')!.classList.contains('is-open')).toBe(false);
  });

  it('тап по тексту раскрывает все имена, повторный — сворачивает (title на касании не виден)', () => {
    renderLine(state({ missing: MANY }));
    fireEvent.click(lineText());
    expect(lineText().textContent).toBe(`Нет на карте 7 из концептуализации: ${ALL}`);
    expect(lineText().getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector('.mm2-sync')!.classList.contains('is-open')).toBe(true);
    fireEvent.click(lineText());
    expect(lineText().textContent).toContain('и ещё 4');
    expect(generate).not.toHaveBeenCalled(); // тап по тексту — не «Добавить на карту»
  });

  it('у короткой строки без списка («Совпадает») текст не кнопка', () => {
    renderLine(state());
    expect(lineText().tagName).toBe('SPAN');
    expect(screen.queryByRole('button')).toBeNull();
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
    expect(CONCEPT_SYNC_TO_MAP_EVENT).toBe('concept_sync_to_map'); // литерал в хуке видит трипваер analytics-sync
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
