// @vitest-environment jsdom
// ViewCard — просмотр сохранённой карточки схемы из истории (read-after-write:
// проверяем, что то, что сохранено во FlashcardEntry, действительно отображается).
// Ловит регресс «поле есть в данных, но пропало из отображения».
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ViewCard } from './ViewCard';
import type { FlashcardEntry, ModeData } from './types';

afterEach(() => {
  cleanup();
});

const MODES: ModeData[] = [
  {
    id: 'vulnerable_child',
    emoji: '😢',
    label: 'Уязвимый Ребёнок',
    desc: 'Грустно',
    response: '...',
    color: '#60a5fa',
  },
];

describe('ViewCard', () => {
  it('показывает режим, рефлексию, потребность и шаг из сохранённой записи', () => {
    const entry: FlashcardEntry = {
      id: 1,
      date: '3 августа',
      mode: 'vulnerable_child',
      reflection: 'Чувствую себя покинутым',
      needId: 'attachment',
      action: 'Написать другу',
    };
    render(<ViewCard viewing={entry} modes={MODES} onClose={() => {}} />);
    expect(screen.getByText('3 августа')).toBeTruthy();
    expect(screen.getByText(/Уязвимый Ребёнок/)).toBeTruthy();
    expect(screen.getByText('Чувствую себя покинутым')).toBeTruthy();
    expect(screen.getByText(/Привязанность/)).toBeTruthy();
    expect(screen.getByText('Написать другу')).toBeTruthy();
  });

  it('без рефлексии/шага показывает только заполненные поля (нет мусора)', () => {
    const entry: FlashcardEntry = {
      id: 2,
      date: '2 августа',
      mode: 'unknown_mode',
      reflection: '',
      needId: 'no_such_need',
      action: '',
    };
    render(<ViewCard viewing={entry} modes={MODES} onClose={() => {}} />);
    expect(screen.queryByText('Рефлексия')).toBeNull();
    expect(screen.queryByText('Шаг')).toBeNull();
    expect(screen.queryByText('Потребность')).toBeNull();
    // Неизвестный режим — фолбэк на raw id, а не выдуманное имя
    expect(screen.getByText(/unknown_mode/)).toBeTruthy();
  });
});
