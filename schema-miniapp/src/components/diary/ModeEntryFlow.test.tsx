// @vitest-environment jsdom
// Дневник режимов в три шага: состояние обычными словами → уточнение режима →
// запись. Тест идёт ровно тем путём, которым идёт человек, впервые открывший
// дневник: ни одного термина до второго шага, обязательное поле одно.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  render,
  screen,
  fireEvent,
  cleanup,
  waitFor,
} from '@testing-library/react';
import { ModeEntrySheet } from './ModeEntrySheet';

vi.mock('../../api', () => ({
  api: { trackEvent: vi.fn() },
}));

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

const STATE_ROW = 'Отключаюсь, убегаю, залипаю';

function openSheet(onSave = vi.fn().mockResolvedValue(undefined)) {
  render(<ModeEntrySheet onClose={vi.fn()} onSave={onSave} />);
  return onSave;
}

describe('дневник режимов — три шага', () => {
  it('шаг 1 спрашивает состояние обычными словами, без терминов', () => {
    openSheet();
    expect(screen.getByText('Что с тобой сейчас?')).toBeTruthy();
    expect(screen.getByText(STATE_ROW)).toBeTruthy();
    expect(screen.getByText('Шаг 1 из 3 · состояние')).toBeTruthy();
    // поле записи появляется только на третьем шаге
    expect(screen.queryByPlaceholderText(/позвонил папа/)).toBeNull();
  });

  it('состояние → кандидат → запись: сохраняется выбранный режим и ситуация', async () => {
    const onSave = openSheet();

    fireEvent.click(screen.getByText(STATE_ROW));
    expect(screen.getByText('Кто из режимов сейчас ближе всего?')).toBeTruthy();
    // сводка держит контекст: видно, что было выбрано шагом раньше
    expect(screen.getByText('Твоё состояние')).toBeTruthy();

    fireEvent.click(screen.getByText('Отстранённый Защитник'));
    expect(screen.getByText('Шаг 3 из 3 · запись')).toBeTruthy();

    const situation = screen.getByPlaceholderText(/позвонил папа/);
    fireEvent.change(situation, { target: { value: 'ушёл в ленту на час' } });
    fireEvent.click(screen.getByText('Сохранить запись'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      modeId: 'detached_protector',
      situation: 'ушёл в ленту на час',
    });
  });

  it('без ситуации сохранить нельзя, и об этом сказано словами', () => {
    openSheet();
    fireEvent.click(screen.getByText(STATE_ROW));
    fireEvent.click(screen.getByText('Отстранённый Защитник'));

    const save = screen.getByText('Сохранить запись');
    expect(save.hasAttribute('disabled')).toBe(true);
    expect(
      screen.getByText('Опиши ситуацию — и запись сохранится'),
    ).toBeTruthy();
  });

  it('«Не могу выбрать» ведёт к телесным маркерам, а не в тупик', () => {
    openSheet();
    fireEvent.click(screen.getByText(STATE_ROW));
    fireEvent.click(screen.getByText('Не могу выбрать — пусть подскажет тело'));

    expect(screen.getByText('Не знаю, что чувствую, или пусто')).toBeTruthy();
    expect(screen.getByText('Пусто и ровно, как в вате')).toBeTruthy();
    // из этой семьи выход уже другой — обратно к списку состояний
    fireEvent.click(
      screen.getByText('Не могу выбрать — вернуться к состояниям'),
    );
    expect(screen.getByText('Что с тобой сейчас?')).toBeTruthy();
  });

  it('«Назад» с шага записи возвращает к кандидатам той же семьи', () => {
    openSheet();
    fireEvent.click(screen.getByText(STATE_ROW));
    fireEvent.click(screen.getByText('Отстранённый Защитник'));

    fireEvent.click(screen.getByLabelText('Назад'));
    expect(screen.getByText('Кто из режимов сейчас ближе всего?')).toBeTruthy();
    expect(screen.getByText('Отстранённый Защитник')).toBeTruthy();
  });

  it('черновик с режимом открывается сразу на записи, а «Назад» знает семью режима', () => {
    localStorage.setItem(
      'diary_draft_mode',
      JSON.stringify({
        startedAt: new Date().toISOString(),
        data: { modeId: 'detached_protector', situation: 'вчерашний созвон' },
      }),
    );
    openSheet();

    expect(screen.getByDisplayValue('вчерашний созвон')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Назад'));
    // семью восстановили по режиму — иначе «Назад» уводил бы в пустой экран
    expect(screen.getByText('Кто из режимов сейчас ближе всего?')).toBeTruthy();
  });

  it('термины доступны, но спрятаны за раскрытием', () => {
    openSheet();
    expect(screen.queryByText('Карающий Критик')).toBeNull();
    fireEvent.click(screen.getByText(/Все режимы по группам/));
    expect(screen.getByText('Карающий Критик')).toBeTruthy();
  });
});
