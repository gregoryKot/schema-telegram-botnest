// @vitest-environment jsdom
// HistoryList — список сохранённых карточек схемы. Проверяет пустое
// состояние (правило «никаких хардкод-заглушек» — на чистом списке текст
// «Пока нет сохранённых карточек», а не выдуманные записи) и клик по
// карточке → onView с самим объектом (read-after-write: список показывает
// реальные сохранённые данные, клик открывает именно ту запись).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HistoryList } from './HistoryList';
import type { FlashcardEntry, ModeData } from './types';

afterEach(() => {
  cleanup();
});

const MODES: ModeData[] = [
  {
    id: 'angry_child',
    emoji: '😡',
    label: 'Злой Ребёнок',
    desc: 'Злость',
    response: '...',
    color: '#f87171',
  },
];

describe('HistoryList', () => {
  it('на пустой истории показывает пустое состояние, а не заглушку', () => {
    render(
      <HistoryList
        allCards={[]}
        modes={MODES}
        onClose={() => {}}
        onView={() => {}}
      />,
    );
    expect(screen.getByText('Пока нет сохранённых карточек')).toBeTruthy();
  });

  it('клик по карточке вызывает onView с этой же записью (read-after-write)', () => {
    const onView = vi.fn();
    const card: FlashcardEntry = {
      id: 'abc',
      date: '1 августа',
      mode: 'angry_child',
      reflection: '',
      needId: 'limits',
      action: 'Сделать паузу',
    };
    render(
      <HistoryList
        allCards={[card]}
        modes={MODES}
        onClose={() => {}}
        onView={onView}
      />,
    );
    fireEvent.click(screen.getByText('1 августа'));
    expect(onView).toHaveBeenCalledWith(card);
  });

  it('показывает шаг карточки, если он был сохранён', () => {
    const card: FlashcardEntry = {
      id: 'xyz',
      date: '1 августа',
      mode: 'angry_child',
      reflection: '',
      needId: 'limits',
      action: 'Сделать паузу',
    };
    render(
      <HistoryList
        allCards={[card]}
        modes={MODES}
        onClose={() => {}}
        onView={() => {}}
      />,
    );
    expect(screen.getByText('→ Сделать паузу')).toBeTruthy();
  });
});
