// @vitest-environment jsdom
// DraftCard — карточка черновика записи дневника (0% покрытия). Read-after-
// write: черновик сохраняется через saveDraft (в другом месте — форме
// дневника) и читается здесь через loadDraft — тестируем связку «сохранил →
// нашёл», плюс двухшаговое подтверждение удаления (защита от случайного тапа).
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { saveDraft } from '../../../../../shared/src/utils/drafts';
import { DraftCard } from './DraftCard';

afterEach(cleanup);
beforeEach(() => localStorage.clear());

describe('DraftCard — нет черновика', () => {
  it('loadDraft ничего не находит — компонент не рендерится', () => {
    const { container } = render(
      <DraftCard
        type="schema"
        color="#a78bfa"
        onContinue={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(container.textContent).toBe('');
  });
});

describe('DraftCard — есть сохранённый черновик (read-after-write)', () => {
  it('черновик схемы, сохранённый через saveDraft, показывается с превью триггера', () => {
    saveDraft('schema', { trigger: 'Коллега не ответил на сообщение' });
    render(
      <DraftCard
        type="schema"
        color="#a78bfa"
        onContinue={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText('Черновик')).toBeTruthy();
    expect(screen.getByText('Коллега не ответил на сообщение')).toBeTruthy();
  });

  it('черновик режима — превью берёт situation, а не trigger', () => {
    saveDraft('mode', { situation: 'Сорвался на ребёнка' });
    render(
      <DraftCard
        type="mode"
        color="#60a5fa"
        onContinue={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText('Сорвался на ребёнка')).toBeTruthy();
  });

  it('«Продолжить» зовёт onContinue', () => {
    saveDraft('schema', { trigger: 'x' });
    const onContinue = vi.fn();
    render(
      <DraftCard
        type="schema"
        color="#a78bfa"
        onContinue={onContinue}
        onDelete={() => {}}
      />,
    );
    fireEvent.click(screen.getByText('Продолжить'));
    expect(onContinue).toHaveBeenCalled();
  });

  it('удаление — двухшаговое: первый клик просит подтверждение, второй зовёт onDelete', () => {
    saveDraft('schema', { trigger: 'x' });
    const onDelete = vi.fn();
    render(
      <DraftCard
        type="schema"
        color="#a78bfa"
        onContinue={() => {}}
        onDelete={onDelete}
      />,
    );
    fireEvent.click(screen.getByText('Удалить'));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Да, удалить')).toBeTruthy();
    fireEvent.click(screen.getByText('Да, удалить'));
    expect(onDelete).toHaveBeenCalled();
  });

  it('длинное превью (>80 символов) обрезается с многоточием', () => {
    const long = 'ф'.repeat(120);
    saveDraft('schema', { trigger: long });
    render(
      <DraftCard
        type="schema"
        color="#a78bfa"
        onContinue={() => {}}
        onDelete={() => {}}
      />,
    );
    expect(screen.getByText(`${'ф'.repeat(80)}…`)).toBeTruthy();
  });
});
