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

const catalog = buildTaskCatalog(guide, (ty) => ty);
const first = catalog[0];
const text = (task: typeof first, variant = 0) => customTaskText({ title: task.title, text: task.variants[variant].text });
const textarea = () => screen.getByPlaceholderText('Например: позвонить другу раз в неделю') as HTMLTextAreaElement;

function renderSheet(clientId?: UserId, preset: Partial<Parameters<typeof TaskCreateSheet>[0]> = {}) {
  render(<MemoryRouter><TaskCreateSheet clientId={clientId} {...preset} onCreated={vi.fn()} onClose={vi.fn()} /></MemoryRouter>);
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
    expect(screen.getByText(first.why)).toBeTruthy();
    fireEvent.click(screen.getByText('Взять'));
    expect(textarea().value).toBe(text(first));

    fireEvent.change(textarea(), { target: { value: `${text(first)}\nдо пятницы` } });
    fireEvent.click(screen.getByText('Назначить задание'));
    await waitFor(() => expect(mockApi.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'custom', text: `${text(first)}\nдо пятницы`, clientId: 42, catalogId: first.id }),
    ));
    expect(mockApi.trackEvent).toHaveBeenCalledWith('task_assign_source', { source: 'catalog' });
  });

  it('у названия с разными текстами «Взять» есть у каждого варианта — в задание идёт выбранный', async () => {
    const many = catalog.find((t) => t.variants.length > 1)!;
    renderSheet(42);
    fireEvent.click(await screen.findByText(many.title));
    const takes = screen.getAllByText('Взять этот вариант');
    expect(takes).toHaveLength(many.variants.length);
    fireEvent.click(takes[1]);
    expect(textarea().value).toBe(text(many, 1));
  });

  it('текст справочника стёрт целиком и написан свой — catalogId не уходит, источник custom', async () => {
    mockApi.createTask.mockResolvedValue({ id: 1 });
    renderSheet(42);
    fireEvent.click(await screen.findByText(first.title));
    fireEvent.click(screen.getByText('Взять'));
    fireEvent.change(textarea(), { target: { value: '' } });
    fireEvent.change(textarea(), { target: { value: 'своё' } });
    fireEvent.click(screen.getByText('Назначить задание'));
    await waitFor(() => expect(mockApi.createTask).toHaveBeenCalled());
    expect(mockApi.createTask.mock.calls[0][0]).toMatchObject({ text: 'своё', catalogId: undefined });
    expect(mockApi.trackEvent).toHaveBeenCalledWith('task_assign_source', { source: 'custom' });
  });

  it('лист открыт из «Дать заданием» или шаблона — источник guide / template, а после смены типа — плитка', async () => {
    mockApi.createTask.mockResolvedValue({ id: 1 });
    renderSheet(42, { defaultType: 'custom', defaultText: text(first), defaultCatalogId: first.id, assignOrigin: 'guide' });
    fireEvent.click(screen.getByText('Назначить задание'));
    await waitFor(() => expect(mockApi.trackEvent).toHaveBeenCalledWith('task_assign_source', { source: 'guide' }));
    cleanup(); vi.clearAllMocks();

    renderSheet(42, { defaultType: 'safe_place', assignOrigin: 'template' });
    fireEvent.click(screen.getByText('Назначить задание'));
    await waitFor(() => expect(mockApi.trackEvent).toHaveBeenCalledWith('task_assign_source', { source: 'template' }));
    cleanup(); vi.clearAllMocks();

    renderSheet(42, { defaultType: 'safe_place', assignOrigin: 'template' });
    fireEvent.click(screen.getByText('Трекер потребностей'));
    fireEvent.click(screen.getByText('Назначить задание'));
    await waitFor(() => expect(mockApi.trackEvent).toHaveBeenCalledWith('task_assign_source', { source: 'tile' }));
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
