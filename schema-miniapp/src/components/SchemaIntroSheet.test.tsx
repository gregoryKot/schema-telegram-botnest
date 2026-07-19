// @vitest-environment jsdom
// Аудит автосейв-паттернов (CLAUDE.md, инцидент useClientDetail: setTimeout
// в замыкании читал state ДО применения текущей правки). SchemaIntroSheet
// использует другую форму: `set()` строит `next` синхронно из своих же
// аргументов и кладёт именно его в замыкание setTimeout — не полагаясь на то,
// что React уже закоммитил предыдущий setState. Тест эмпирически проверяет,
// что это НЕ баг: быстрые правки внутри окна дебаунса не теряются.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  act,
  cleanup,
} from '@testing-library/react';
import { SchemaIntroSheet } from './SchemaIntroSheet';

vi.mock('../api', () => ({
  api: { getSchemaNotes: vi.fn(), saveSchemaNote: vi.fn() },
}));
import { api } from '../api';
const mockApi = api as unknown as Record<string, ReturnType<typeof vi.fn>>;

async function openFirstQuestion() {
  render(<SchemaIntroSheet schemaId="abandonment" onClose={() => {}} />);
  await act(async () => {}); // flush getSchemaNotes()
  fireEvent.click(screen.getByText('Что запускает эту схему?'));
  return screen.getByPlaceholderText(/Когда не отвечают на сообщения/);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockApi.getSchemaNotes.mockResolvedValue([]);
  mockApi.saveSchemaNote.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('SchemaIntroSheet — автосейв карточки (setTimeout(1500) в set())', () => {
  it('не отправляет запрос сразу — только после паузы 1500мс', async () => {
    const textarea = await openFirstQuestion();
    fireEvent.change(textarea, { target: { value: 'Триггер' } });
    expect(mockApi.saveSchemaNote).not.toHaveBeenCalled();
  });

  it('НЕ БАГ: серия быстрых правок в одном окне дебаунса — сохраняется ПОСЛЕДНЕЕ значение, один вызов api', async () => {
    const textarea = await openFirstQuestion();
    fireEvent.change(textarea, { target: { value: 'H' } });
    fireEvent.change(textarea, { target: { value: 'He' } });
    fireEvent.change(textarea, { target: { value: 'Her' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(mockApi.saveSchemaNote).toHaveBeenCalledTimes(1);
    expect(mockApi.saveSchemaNote.mock.calls[0][0]).toMatchObject({
      schemaId: 'abandonment',
      triggers: 'Her',
    });
  });

  it('НЕ БАГ: вторая (последующая) волна правок после завершённого автосейва не отстаёт на шаг', async () => {
    const textarea = await openFirstQuestion();
    // Первый цикл — долетает до завершения.
    fireEvent.change(textarea, { target: { value: 'A' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(mockApi.saveSchemaNote.mock.calls[0][0].triggers).toBe('A');

    // Второй цикл начинается ПОСЛЕ первого — если бы `set()` читал устаревшее
    // замыкание (баг класса localConceptRef), сюда бы долетело 'A', а не 'AB'.
    fireEvent.change(textarea, { target: { value: 'AB' } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1500);
    });
    expect(mockApi.saveSchemaNote).toHaveBeenCalledTimes(2);
    expect(mockApi.saveSchemaNote.mock.calls[1][0].triggers).toBe('AB');
  });
});
