// createConceptMap — общая сборка карты «Концептуализация» (#963) для типа в
// «Новая карта» и кнопки «Открыть на холсте»: фигуры из полей, kind 'concept',
// при отказе — телеметрия и уборка пустой карты.
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../api', () => ({
  api: { createModeMap: vi.fn(), updateModeMap: vi.fn(), deleteModeMap: vi.fn(), trackEvent: vi.fn() },
  reportClientError: vi.fn(),
}));
import { api, reportClientError } from '../../api';
import { CONCEPT_CANVAS_OPEN_EVENT } from '../../../../shared/src/share/analytics';
import { createConceptMap } from './createConceptMap';
import { conceptMapTitle } from './mapKinds';

const source = { modeIds: ['vulnerable_child'], schemaIds: ['abandonment'], modeLinks: [], schemaLinks: [] };
const created = { id: 21, title: 't', kind: 'concept', nodes: [], edges: [], createdAt: '', updatedAt: '' };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.createModeMap).mockResolvedValue(created as never);
  vi.mocked(api.deleteModeMap).mockResolvedValue(undefined as never);
});

describe('createConceptMap', () => {
  it('создаёт карту kind concept, пишет фигуры из полей и возвращает её с ними', async () => {
    vi.mocked(api.updateModeMap).mockResolvedValue({} as never);
    const map = await createConceptMap({ clientId: 7, source, form: 'ty', taken: [] });
    expect(api.createModeMap).toHaveBeenCalledWith(7, conceptMapTitle(), 'concept');
    const body = vi.mocked(api.updateModeMap).mock.calls[0][1] as { nodes: { type: string }[] };
    expect(vi.mocked(api.updateModeMap).mock.calls[0][0]).toBe(21);
    const types = body.nodes.map(n => n.type);
    expect(types).toContain('child'); // режим из полей
    expect(types).toContain('schema'); // схема из полей
    expect(types).toContain('needs'); // круг потребностей
    expect(map).toMatchObject({ id: 21, kind: 'concept', nodes: body.nodes });
    expect(api.trackEvent).toHaveBeenCalledWith(CONCEPT_CANVAS_OPEN_EVENT);
    expect(api.deleteModeMap).not.toHaveBeenCalled();
  });

  it('заголовок занят — номер дня', async () => {
    vi.mocked(api.updateModeMap).mockResolvedValue({} as never);
    await createConceptMap({ clientId: 7, source, form: 'vy', taken: [conceptMapTitle()] });
    expect(vi.mocked(api.createModeMap).mock.calls[0][1]).toBe(`${conceptMapTitle()} (2)`);
  });

  it('фигуры не записались — пустая карта удаляется, отказ в телеметрии и у вызывающего', async () => {
    vi.mocked(api.updateModeMap).mockRejectedValue(new Error('500'));
    await expect(createConceptMap({ clientId: 7, source, form: 'ty', taken: [] })).rejects.toThrow('500');
    expect(api.deleteModeMap).toHaveBeenCalledWith(21);
    expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({ message: 'concept canvas open failed: 500' }));
    expect(api.trackEvent).not.toHaveBeenCalled();
  });

  it('карта не создалась — удалять нечего', async () => {
    vi.mocked(api.createModeMap).mockRejectedValue(new Error('403'));
    await expect(createConceptMap({ clientId: 7, source, form: 'ty', taken: [] })).rejects.toThrow('403');
    expect(api.updateModeMap).not.toHaveBeenCalled();
    expect(api.deleteModeMap).not.toHaveBeenCalled();
  });

  it('уборка тоже упала — и это уходит в телеметрию, а не молчит', async () => {
    vi.mocked(api.updateModeMap).mockRejectedValue(new Error('500'));
    vi.mocked(api.deleteModeMap).mockRejectedValue(new Error('net'));
    await expect(createConceptMap({ clientId: 7, source, form: 'ty', taken: [] })).rejects.toThrow();
    await vi.waitFor(() =>
      expect(reportClientError).toHaveBeenCalledWith(expect.objectContaining({ message: 'concept canvas cleanup failed' })));
  });
});
