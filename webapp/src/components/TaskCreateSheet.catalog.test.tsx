// @vitest-environment jsdom
// «Из справочника» в листе «Новое задание»: раздел виден терапевту (и для клиента без аккаунта),
// «Взять» подставляет текст в «Своё задание», источник уходит в аналитику.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TaskCreateSheet } from './TaskCreateSheet';
import * as guide from '../../../shared/src/schemaTherapy/guide';
import { buildTaskCatalog, customTaskText } from '../../../shared/src/tasks/catalog/taskCatalog';
import type { UserId } from '../api';

vi.mock('../api', () => ({ api: { createTask: vi.fn(), trackEvent: vi.fn() } }));
import { api } from '../api';
const mockApi = api as unknown as { createTask: ReturnType<typeof vi.fn>; trackEvent: ReturnType<typeof vi.fn> };

const first = buildTaskCatalog(guide, (ty) => ty)[0];
const textarea = () => screen.getByPlaceholderText('Например: позвонить другу раз в неделю') as HTMLTextAreaElement;

function renderSheet(clientId?: UserId) {
  render(<MemoryRouter><TaskCreateSheet clientId={clientId} onCreated={vi.fn()} onClose={vi.fn()} /></MemoryRouter>);
}

beforeEach(() => { vi.clearAllMocks(); });
afterEach(() => { cleanup(); });

describe('TaskCreateSheet — «Из справочника»', () => {
  it('клиент без аккаунта: одна плитка «Своё задание», пояснение и весь справочник', async () => {
    renderSheet(-5);
    expect(screen.getAllByRole('button', { pressed: true }).map((b) => b.textContent)).toEqual([expect.stringContaining('Своё задание')]);
    expect(screen.queryByText('Трекер потребностей')).toBeNull();
    expect(screen.getByText(/когда клиент подключится/)).toBeTruthy();
    expect(await screen.findByText(first.title)).toBeTruthy();
  });

  it('«Взять» переключает на «Своё задание» с текстом записи, назначение шлёт источник catalog', async () => {
    mockApi.createTask.mockResolvedValue({ id: 1 });
    renderSheet(42);
    expect(screen.queryByText('Взять')).toBeNull();
    fireEvent.click(await screen.findByText(first.title));
    expect(screen.getByText('Когда давать')).toBeTruthy();
    fireEvent.click(screen.getByText('Взять'));
    expect(textarea().value).toBe(customTaskText(first));

    fireEvent.change(textarea(), { target: { value: `${customTaskText(first)}\nдо пятницы` } });
    fireEvent.click(screen.getByText('Назначить задание'));
    await waitFor(() => expect(mockApi.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'custom', text: `${customTaskText(first)}\nдо пятницы`, clientId: 42 }),
    ));
    expect(mockApi.trackEvent).toHaveBeenCalledWith('task_assign_source', { source: 'catalog' });
  });

  it('поиск без совпадений — «Ничего не нашлось»; своей цели клиента раздел не показывается', async () => {
    renderSheet(42);
    await screen.findByText(first.title);
    fireEvent.change(screen.getByLabelText('Найти задание в справочнике'), { target: { value: 'ъъъ' } });
    expect(screen.getByText('Ничего не нашлось')).toBeTruthy();
    cleanup();
    renderSheet();
    expect(screen.queryByText('Из справочника')).toBeNull();
  });
});
