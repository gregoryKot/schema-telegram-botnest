// @vitest-environment jsdom
// Хаб «Мои дневники»: что видит человек на чистом аккаунте и что — когда
// записи уже есть. Главное здесь — чип серии и мета-строки: они показывают
// только реальные данные профиля, без выдуманных чисел.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { HomeView } from './HomeView';

afterEach(() => cleanup());

const base = {
  schemaDiaryCount: 0,
  modeDiaryCount: 0,
  gratitudeDiaryCount: 0,
  onOpen: vi.fn(),
};

describe('HomeView — хаб дневников', () => {
  // В8 дизайн-аудита 2026-08: «Мои дневники» — заголовок экрана (h1).
  it('«Мои дневники» — h1', () => {
    render(<HomeView {...base} streak={0} />);
    expect(
      screen.getByRole('heading', { level: 1, name: 'Мои дневники' }),
    ).toBeTruthy();
  });

  it('на чистом аккаунте нет чипа серии и нет выдуманных цифр', () => {
    const { container } = render(<HomeView {...base} streak={0} />);
    expect(screen.getAllByText('Пока пусто').length).toBe(3);
    expect(container.textContent).not.toContain('дней');
  });

  it('серия показывается со склонением, когда она реально есть', () => {
    render(<HomeView {...base} streak={1} />);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('день')).toBeTruthy();
    cleanup();

    render(<HomeView {...base} streak={17} />);
    expect(screen.getByText('дней')).toBeTruthy();
  });

  it('дневники сгруппированы под капс-заголовком «Записать момент»', () => {
    render(<HomeView {...base} />);
    expect(screen.getByText('Записать момент')).toBeTruthy();
    for (const title of [
      'Дневник схем',
      'Дневник режимов',
      'Дневник благодарности',
    ]) {
      expect(screen.getByText(title)).toBeTruthy();
    }
  });

  it('строка трекера появляется только вместе с переходом в него', () => {
    render(<HomeView {...base} />);
    expect(screen.queryByText('Трекер потребностей')).toBeNull();
    cleanup();

    const onOpenTracker = vi.fn();
    render(<HomeView {...base} onOpenTracker={onOpenTracker} />);
    fireEvent.click(screen.getByText('Трекер потребностей'));
    expect(onOpenTracker).toHaveBeenCalledTimes(1);
  });

  it('счётчик записей берётся из реальных данных', () => {
    render(
      <HomeView
        {...base}
        modeDiaryCount={3}
        lastModeDiaryDate={new Date().toISOString()}
      />,
    );
    expect(screen.getByText('3 записи · сегодня')).toBeTruthy();
  });
});
