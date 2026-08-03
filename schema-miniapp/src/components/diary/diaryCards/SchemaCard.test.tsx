// @vitest-environment jsdom
// Карточка записи дневника схем (CLAUDE.md — приоритет покрытия «карточки
// схем/режимов»). Поведение: свёрнутое/развёрнутое состояние, обрезка
// длинного триггера, двухшаговое подтверждённое удаление.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { SchemaCard } from './SchemaCard';
import type { SchemaDiaryEntry } from '../../../types';

afterEach(() => {
  cleanup();
});

function entry(overrides: Partial<SchemaDiaryEntry> = {}): SchemaDiaryEntry {
  return {
    id: 1,
    createdAt: '2026-08-01T10:00:00.000Z',
    trigger: 'Партнёр не ответил на сообщение',
    emotions: [{ id: 'fear', intensity: 6 }],
    schemaIds: ['abandonment'],
    thoughts: null,
    bodyFeelings: null,
    actualBehavior: null,
    schemaOrigin: null,
    healthyView: null,
    realProblems: null,
    excessiveReactions: null,
    healthyBehavior: null,
    ...overrides,
  };
}

describe('SchemaCard', () => {
  it('свёрнуто по умолчанию — показывает триггер и не показывает поля деталей', () => {
    render(<SchemaCard entry={entry()} color="#f472b6" onDelete={() => {}} />);
    expect(screen.getByText('Партнёр не ответил на сообщение')).toBeTruthy();
    expect(screen.queryByText('Удалить')).toBeNull();
  });

  it('клик разворачивает карточку и показывает заполненные поля', () => {
    render(
      <SchemaCard
        entry={entry({ thoughts: 'Меня опять бросят' })}
        color="#f472b6"
        onDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Партнёр не ответил на сообщение'));
    expect(screen.getByText('Меня опять бросят')).toBeTruthy();
    expect(screen.getByText('Удалить')).toBeTruthy();
  });

  it('пустые опциональные поля — соответствующие блоки не рендерятся', () => {
    render(<SchemaCard entry={entry()} color="#f472b6" onDelete={() => {}} />);
    fireEvent.click(screen.getByText('Партнёр не ответил на сообщение'));
    expect(screen.queryByText('Мысли')).toBeNull();
    expect(screen.queryByText('Тело')).toBeNull();
  });

  it('длинный триггер обрезается в свёрнутом виде и раскрывается полностью', () => {
    const longTrigger = 'A'.repeat(120);
    render(
      <SchemaCard
        entry={entry({ trigger: longTrigger })}
        color="#f472b6"
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText(longTrigger.slice(0, 80) + '…')).toBeTruthy();
    fireEvent.click(screen.getByText(longTrigger.slice(0, 80) + '…'));
    expect(screen.getByText(longTrigger)).toBeTruthy();
  });

  it('удаление требует подтверждения: первый клик спрашивает, второй вызывает onDelete', () => {
    const onDelete = vi.fn();
    render(<SchemaCard entry={entry()} color="#f472b6" onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Партнёр не ответил на сообщение'));
    fireEvent.click(screen.getByText('Удалить'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Удалить навсегда')).toBeTruthy();

    fireEvent.click(screen.getByText('Удалить навсегда'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('«Отмена» на шаге подтверждения возвращает к обычной кнопке без удаления', () => {
    const onDelete = vi.fn();
    render(<SchemaCard entry={entry()} color="#f472b6" onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Партнёр не ответил на сообщение'));
    fireEvent.click(screen.getByText('Удалить'));
    fireEvent.click(screen.getByText('Отмена'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Удалить')).toBeTruthy();
  });
});
