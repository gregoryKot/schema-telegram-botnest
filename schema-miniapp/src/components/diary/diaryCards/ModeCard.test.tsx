// @vitest-environment jsdom
// Карточка записи дневника режимов (CLAUDE.md — приоритет покрытия «карточки
// схем/режимов»). Поведение: свёрнутое/развёрнутое состояние, метка режима,
// отфильтрованные пустые поля, подтверждённое удаление, кнопка «поделиться»
// показывается только когда есть ответ Здорового Взрослого.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModeCard } from './ModeCard';
import type { ModeDiaryEntry } from '../../../types';

afterEach(() => {
  cleanup();
});

function entry(overrides: Partial<ModeDiaryEntry> = {}): ModeDiaryEntry {
  return {
    id: 1,
    createdAt: '2026-08-01T10:00:00.000Z',
    modeId: 'punitive_critic',
    situation: 'Накричал на себя за ошибку в отчёте',
    thoughts: null,
    feelings: null,
    bodyFeelings: null,
    actions: null,
    actualNeed: null,
    childhoodMemories: null,
    healthyResponse: null,
    ...overrides,
  };
}

describe('ModeCard', () => {
  it('свёрнуто по умолчанию — показывает название режима и ситуацию', () => {
    render(<ModeCard entry={entry()} color="#a78bfa" onDelete={() => {}} />);
    expect(screen.getByText(/Карающий Критик/)).toBeTruthy();
    expect(
      screen.getByText('Накричал на себя за ошибку в отчёте'),
    ).toBeTruthy();
  });

  it('неизвестный modeId — просто не показывает метку режима, но не падает', () => {
    render(
      <ModeCard
        entry={entry({ modeId: 'not-a-real-mode' })}
        color="#a78bfa"
        onDelete={() => {}}
      />,
    );
    expect(
      screen.getByText('Накричал на себя за ошибку в отчёте'),
    ).toBeTruthy();
  });

  it('клик разворачивает карточку и показывает только заполненные поля', () => {
    render(
      <ModeCard
        entry={entry({ thoughts: 'Я неудачник', feelings: null })}
        color="#a78bfa"
        onDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Накричал на себя за ошибку в отчёте'));
    expect(screen.getByText('Я неудачник')).toBeTruthy();
    expect(screen.queryByText('Чувства')).toBeNull();
  });

  it('без ответа Здорового Взрослого — кнопка «поделиться» не показана', () => {
    render(<ModeCard entry={entry()} color="#a78bfa" onDelete={() => {}} />);
    fireEvent.click(screen.getByText('Накричал на себя за ошибку в отчёте'));
    expect(screen.queryByLabelText(/поделиться/i)).toBeNull();
  });

  it('с ответом Здорового Взрослого — блок «поделиться» появляется', () => {
    render(
      <ModeCard
        entry={entry({ healthyResponse: 'Ошибка — это не приговор' })}
        color="#a78bfa"
        onDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Накричал на себя за ошибку в отчёте'));
    expect(screen.getByText('Ошибка — это не приговор')).toBeTruthy();
    expect(
      screen.getByText(
        'Можно сохранить карточку и перечитывать, когда снова накроет.',
      ),
    ).toBeTruthy();
  });

  it('удаление требует подтверждения перед вызовом onDelete', () => {
    const onDelete = vi.fn();
    render(<ModeCard entry={entry()} color="#a78bfa" onDelete={onDelete} />);
    fireEvent.click(screen.getByText('Накричал на себя за ошибку в отчёте'));
    fireEvent.click(screen.getByText('Удалить'));
    expect(onDelete).not.toHaveBeenCalled();
    fireEvent.click(screen.getByText('Удалить навсегда'));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  // См. комментарий в SchemaCard.test.tsx: обрезает CSS, не JS.
  it('длинная ситуация показана одной строкой, пока запись свёрнута', () => {
    const longSituation = 'B'.repeat(100);
    render(
      <ModeCard
        entry={entry({ situation: longSituation })}
        color="#a78bfa"
        onDelete={() => {}}
      />,
    );
    const line = screen.getByText(longSituation);
    expect(line.className).toContain('d-clamp');
    fireEvent.click(line);
    expect(screen.getByText(longSituation).className).not.toContain('d-clamp');
  });
});
