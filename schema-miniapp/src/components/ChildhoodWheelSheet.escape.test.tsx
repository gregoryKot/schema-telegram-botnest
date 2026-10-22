// @vitest-environment jsdom
// Аудит 2026-10: Escape над описанием схемы (SchemaDescSheet) закрывал и его,
// и колесо под ним — с побочным finish() (флаг «пройдено» + onClose). Здесь
// настоящие BottomSheet и SchemaDescSheet; подставлены только фазы.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ChildhoodWheelSheet, CHILDHOOD_DONE_KEY } from './ChildhoodWheelSheet';

vi.mock('../api', () => ({
  api: {
    getChildhoodRatings: vi.fn().mockResolvedValue({}),
    saveChildhoodRatings: vi.fn(),
  },
}));
vi.mock('./childhoodWheelSheet/ResultPhaseGate', () => ({
  ResultPhaseGate: ({
    setActiveSchema,
  }: {
    setActiveSchema: (s: { name: string; desc: string; color: string }) => void;
  }) => (
    <button
      onClick={() =>
        setActiveSchema({
          name: 'Покинутость',
          desc: 'описание-схемы',
          color: '#888',
        })
      }
    >
      открыть-описание
    </button>
  ),
}));

beforeEach(() => localStorage.setItem(CHILDHOOD_DONE_KEY, '1'));
afterEach(() => {
  cleanup();
  localStorage.clear();
});

describe('ChildhoodWheelSheet — Escape над описанием схемы', () => {
  it('закрывает только описание: колесо под ним не завершается', () => {
    const onClose = vi.fn();
    render(<ChildhoodWheelSheet onClose={onClose} onOpenSchemas={() => {}} />);
    fireEvent.click(screen.getByText('открыть-описание'));
    expect(screen.getByText('описание-схемы')).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText('описание-схемы')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();

    // Описания больше нет — следующий Escape закрывает само колесо.
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
