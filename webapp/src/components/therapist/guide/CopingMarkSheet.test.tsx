// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CopingMarkSheet } from './CopingMarkSheet';

const h = vi.hoisted(() => ({
  getTherapyClients: vi.fn(),
  getGuideMarkClients: vi.fn(),
  getConceptualization: vi.fn(),
  saveConceptualization: vi.fn(),
  trackEvent: vi.fn(),
}));
vi.mock('../../../api', () => ({ api: h, reportClientError: vi.fn() }));

const cell = { schemaId: 'subjugation', style: 'surrender' } as const;
const show = () => render(<MemoryRouter><CopingMarkSheet cell={cell} onClose={() => {}} /></MemoryRouter>);
const link = { schemaId: 'subjugation', belief: '', origin: '', needIds: [], coping: ['surrender'], copingNotes: { surrender: 'уступает начальнику' } };

beforeEach(() => {
  vi.clearAllMocks();
  h.getTherapyClients.mockResolvedValue([
    { telegramId: 11, name: 'Анна', clientAlias: null },
    { telegramId: 12, name: 'Борис', clientAlias: null },
  ]);
  h.getGuideMarkClients.mockResolvedValue({ clientIds: ['11'] });
  h.getConceptualization.mockResolvedValue(null);
  h.saveConceptualization.mockResolvedValue({ schemaIds: ['subjugation'], schemaLinks: [link], updatedAt: 'v2' });
});

describe('CopingMarkSheet — «Про клиента» из «Справочника»', () => {
  it('у кого стиль уже отмечен — пометка; поиск сужает список', async () => {
    show();
    expect(h.getGuideMarkClients).toHaveBeenCalledWith('schema:subjugation/coping.surrender');
    const anna = await screen.findByRole('button', { name: /Анна/ });
    await waitFor(() => expect(anna.textContent).toContain('уже отмечено'));
    expect(screen.getByRole('button', { name: /Борис/ }).textContent).not.toContain('уже отмечено');
    fireEvent.change(screen.getByLabelText('Поиск клиента'), { target: { value: 'бор' } });
    expect(screen.queryByRole('button', { name: /Анна/ })).toBeNull();
  });

  it('новый клиент: отметка уходит в схему случая с автодобавлением схемы, статус «Отмечено у»', async () => {
    show();
    fireEvent.click(await screen.findByRole('button', { name: /Борис/ }));
    fireEvent.click(await screen.findByRole('button', { name: 'Отметить' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Отмечено у Борис'));
    expect(h.saveConceptualization).toHaveBeenCalledWith(12, expect.objectContaining({ baseVersion: null, schemaIds: ['subjugation'] }));
  });

  it('уже отмечено: тап открывает правку заметки, «Снять отметку» убирает стиль; ошибка — отметка как была', async () => {
    h.getConceptualization.mockResolvedValue({ schemaIds: ['subjugation'], schemaLinks: [link], updatedAt: 'v1' });
    h.saveConceptualization.mockRejectedValueOnce({ status: 500 });
    show();
    fireEvent.click(await screen.findByRole('button', { name: /Анна/ }));
    expect(((await screen.findByLabelText('Как это проявляется у клиента')) as HTMLTextAreaElement).value).toBe('уступает начальнику');
    fireEvent.click(screen.getByRole('button', { name: 'Снять отметку' }));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('отметка осталась как была'));
    fireEvent.click(screen.getByRole('button', { name: 'Снять отметку' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Отметка у Анна снята'));
    const body = h.saveConceptualization.mock.calls[1][1];
    expect(body).not.toHaveProperty('schemaIds');
    expect(body.schemaLinksPatch.upsert[0]).not.toHaveProperty('coping');
  });
});
