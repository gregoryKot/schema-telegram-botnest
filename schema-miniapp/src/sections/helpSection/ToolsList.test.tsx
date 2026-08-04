// @vitest-environment jsdom
// ToolsList — 9 строк-переходов раздела «Здесь и сейчас». Проверяем
// плюрализацию подписей (0/1/несколько — русские формы «цель/цели/целей»),
// null-состояние без выдуманных чисел (правило «никаких хардкод-заглушек»:
// count=null → подписи нет вовсе, а не «0») и что клик по строке зовёт
// именно свой обработчик, а не соседний.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ToolsList } from './ToolsList';

afterEach(() => {
  cleanup();
});

function renderList(overrides: Partial<Parameters<typeof ToolsList>[0]> = {}) {
  const handlers = {
    onOpenTasks: vi.fn(),
    onOpenPractices: vi.fn(),
    onOpenPlans: vi.fn(),
    onOpenBeliefCheck: vi.fn(),
    onOpenPhraseCheck: vi.fn(),
    onOpenSafePlace: vi.fn(),
    onOpenLetterToSelf: vi.fn(),
    onOpenFlashcard: vi.fn(),
    onOpenChildhoodWheel: vi.fn(),
  };
  render(
    <ToolsList
      tasksCount={0}
      practiceCount={null}
      planCount={null}
      childhoodDone={false}
      {...handlers}
      {...overrides}
    />,
  );
  return handlers;
}

describe('ToolsList — плюрализация и пустые состояния', () => {
  it('0 целей — «Нет активных», а не «0 целей»', () => {
    renderList({ tasksCount: 0 });
    expect(screen.getByText('Нет активных')).toBeTruthy();
  });

  it('1 цель — единственное число', () => {
    renderList({ tasksCount: 1 });
    expect(screen.getByText('1 цель')).toBeTruthy();
  });

  it('3 цели — форма "цели"', () => {
    renderList({ tasksCount: 3 });
    expect(screen.getByText('3 цели')).toBeTruthy();
  });

  it('5 целей — форма "целей"', () => {
    renderList({ tasksCount: 5 });
    expect(screen.getByText('5 целей')).toBeTruthy();
  });

  it('practiceCount=null — подпись отсутствует (не выдуманный 0)', () => {
    renderList({ practiceCount: null });
    expect(screen.queryByText('Нет практик')).toBeNull();
    expect(screen.queryByText(/практик/)).toBeNull();
  });

  it('planCount=0 — «История пуста»', () => {
    renderList({ planCount: 0 });
    expect(screen.getByText('История пуста')).toBeTruthy();
  });

  it('колесо детства: подпись меняется от того, пройдено ли оно', () => {
    renderList({ childhoodDone: false });
    expect(screen.getByText('Займёт 2 минуты')).toBeTruthy();
    cleanup();
    renderList({ childhoodDone: true });
    expect(screen.getByText('Паттерны из прошлого')).toBeTruthy();
  });
});

describe('ToolsList — клики по строкам зовут свой обработчик', () => {
  it('клик по «Проверка убеждений» зовёт onOpenBeliefCheck, а не соседний', () => {
    const handlers = renderList();
    fireEvent.click(screen.getByText('Проверка убеждений'));
    expect(handlers.onOpenBeliefCheck).toHaveBeenCalledTimes(1);
    expect(handlers.onOpenSafePlace).not.toHaveBeenCalled();
  });

  it('клик по «Разобрать фразу» зовёт onOpenPhraseCheck, а не соседний разбор', () => {
    const handlers = renderList();
    fireEvent.click(screen.getByText('Разобрать фразу'));
    expect(handlers.onOpenPhraseCheck).toHaveBeenCalledTimes(1);
    // Соседняя строка — тоже «проверка», перепутать легко именно её.
    expect(handlers.onOpenBeliefCheck).not.toHaveBeenCalled();
  });

  it('клик по «Колесо детства» зовёт onOpenChildhoodWheel', () => {
    const handlers = renderList();
    fireEvent.click(screen.getByText('Колесо детства'));
    expect(handlers.onOpenChildhoodWheel).toHaveBeenCalledTimes(1);
  });
});
