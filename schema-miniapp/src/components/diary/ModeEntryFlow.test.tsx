// @vitest-environment jsdom
// Дневник режимов в три шага: чувство обычными словами → уточнение режима →
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

const STATE_ROW = 'Нет сил, ничего не хочется';

function openSheet(onSave = vi.fn().mockResolvedValue(undefined)) {
  render(<ModeEntrySheet onClose={vi.fn()} onSave={onSave} />);
  return onSave;
}

describe('дневник режимов — три шага', () => {
  it('шаг 1 спрашивает состояние обычными словами, без терминов', () => {
    openSheet();
    expect(screen.getByText('Что ты сейчас чувствуешь?')).toBeTruthy();
    expect(screen.getByText(STATE_ROW)).toBeTruthy();
    expect(screen.getByText('Шаг 1 из 3 · чувство')).toBeTruthy();
    // поле записи появляется только на третьем шаге
    expect(screen.queryByPlaceholderText(/позвонил папа/)).toBeNull();
  });

  it('состояние → кандидат → запись: сохраняется выбранный режим и ситуация', async () => {
    const onSave = openSheet();

    fireEvent.click(screen.getByText(STATE_ROW));
    expect(screen.getByText('Как это выглядит?')).toBeTruthy();
    // сводка держит контекст: видно, что было выбрано шагом раньше
    expect(screen.getByText('Твоё состояние')).toBeTruthy();

    fireEvent.click(screen.getByText('Избегающий Защитник'));
    expect(screen.getByText('Шаг 3 из 3 · запись')).toBeTruthy();

    const situation = screen.getByPlaceholderText(/позвонил папа/);
    fireEvent.change(situation, { target: { value: 'ушёл в ленту на час' } });
    fireEvent.click(screen.getByText('Сохранить запись'));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0][0]).toMatchObject({
      modeId: 'avoidant_protector',
      situation: 'ушёл в ленту на час',
    });
  });

  it('без ситуации сохранить нельзя, и об этом сказано словами', () => {
    openSheet();
    fireEvent.click(screen.getByText(STATE_ROW));
    fireEvent.click(screen.getByText('Избегающий Защитник'));

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

    expect(screen.getByText('Пусто или не пойму, что чувствую')).toBeTruthy();
    expect(screen.getByText('Пусто и ровно, как в вате')).toBeTruthy();
    // из этих ворот выход уже другой — обратно к списку чувств
    fireEvent.click(screen.getByText('Не могу выбрать — вернуться к чувствам'));
    expect(screen.getByText('Что ты сейчас чувствуешь?')).toBeTruthy();
  });

  it('«Назад» с шага записи возвращает к кандидатам той же семьи', () => {
    openSheet();
    fireEvent.click(screen.getByText(STATE_ROW));
    fireEvent.click(screen.getByText('Избегающий Защитник'));

    fireEvent.click(screen.getByLabelText('Назад'));
    expect(screen.getByText('Как это выглядит?')).toBeTruthy();
    expect(screen.getByText('Избегающий Защитник')).toBeTruthy();
  });

  it('черновик с режимом открывается сразу на записи, а «Назад» знает семью режима', () => {
    localStorage.setItem(
      'diary_draft_mode',
      JSON.stringify({
        startedAt: new Date().toISOString(),
        data: { modeId: 'avoidant_protector', situation: 'вчерашний созвон' },
      }),
    );
    openSheet();

    expect(screen.getByDisplayValue('вчерашний созвон')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Назад'));
    // Ворота восстановили по режиму — иначе «Назад» уводил бы в пустой экран.
    // Черновик хранит только modeId (форма данных не менялась), а режим бывает
    // виден из двух чувств: Избегающий Защитник — и «Страшно», и «Нет сил».
    // Возвращаемся в первые ворота, где он есть, — они его действительно
    // показывают, так что выбор рядом, а не потерян.
    expect(screen.getByText('Про что этот страх?')).toBeTruthy();
    expect(screen.getByText('Избегающий Защитник')).toBeTruthy();
  });

  it('термины доступны, но спрятаны за раскрытием', () => {
    openSheet();
    expect(screen.queryByText('Карающий Критик')).toBeNull();
    fireEvent.click(screen.getByText(/Все режимы по группам/));
    expect(screen.getByText('Карающий Критик')).toBeTruthy();
  });
});
