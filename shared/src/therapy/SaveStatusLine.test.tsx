// @vitest-environment jsdom
// Строка статуса сохранения (issue #879 шаг A): пять статусов, формат времени,
// «Повторить» зовёт onRetry. Время — локальный конструктор Date, чтобы ожидание
// не зависело от зоны машины (сьюты гоняются и под TZ=Australia/Sydney).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import {
  SaveStatusLine,
  formatSavedAt,
  savedAtLabel,
  saveStatusText,
} from './SaveStatusLine';

afterEach(() => cleanup());

// 14:07 СЕГОДНЯШНЕГО локального дня: «в ЧЧ:ММ» рисуется только для того же
// календарного дня, что и now. Фиксированная дата (28 окт.) ломала тест в любой
// другой день и под Sydney уже после 14:00 UTC (там день сменился).
const today = new Date();
const at = new Date(
  today.getFullYear(),
  today.getMonth(),
  today.getDate(),
  14,
  7,
);

describe('saveStatusText', () => {
  it('pending / saving / error — фиксированные нейтральные строки', () => {
    expect(saveStatusText('pending')).toBe('Изменения ещё не сохранены');
    expect(saveStatusText('saving')).toBe('Сохраняю…');
    expect(saveStatusText('error')).toBe('Не сохранилось');
  });

  it('saved — «✓ Сохранено в ЧЧ:ММ», без момента — просто «✓ Сохранено»', () => {
    expect(saveStatusText('saved', at)).toBe('✓ Сохранено в 14:07');
    expect(saveStatusText('saved')).toBe('✓ Сохранено');
    expect(saveStatusText('saved', null)).toBe('✓ Сохранено');
  });

  it('idle — пусто; idle с моментом — «✓ Сохранено в ЧЧ:ММ»', () => {
    expect(saveStatusText('idle')).toBe('');
    expect(saveStatusText('idle', at)).toBe('✓ Сохранено в 14:07');
  });

  it('savedAtLabel: сегодня — «в ЧЧ:ММ», другой день — с датой', () => {
    expect(savedAtLabel(at, at)).toBe('в 14:07');
    // Неделей раньше — явным локальным конструктором, не вычитанием миллисекунд:
    // через 7×86400000 перевод часов (DST) сдвинул бы время с 14:07.
    const weekAgo = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() - 7,
      14,
      7,
    );
    const label = savedAtLabel(weekAgo, at);
    expect(label).toMatch(/^\d{1,2} \S+, 14:07$/);
    expect(label).not.toMatch(/^в /);
    expect(saveStatusText('saved', weekAgo, at)).toBe(`✓ Сохранено ${label}`);
    expect(savedAtLabel(null)).toBeNull();
  });

  it('formatSavedAt: ISO-строка разбирается, мусор и пустота — null', () => {
    expect(formatSavedAt(at.toISOString())).toBe('14:07');
    expect(formatSavedAt('не дата')).toBeNull();
    expect(formatSavedAt(null)).toBeNull();
    expect(formatSavedAt(undefined)).toBeNull();
    // Единицы дополняются нулём: 09:05, не 9:5.
    expect(formatSavedAt(new Date(2026, 0, 1, 9, 5))).toBe('09:05');
  });
});

describe('SaveStatusLine', () => {
  it('idle без savedAt — пустой контейнер со статусной ролью (вёрстка не прыгает)', () => {
    render(<SaveStatusLine status="idle" />);
    const el = screen.getByRole('status');
    expect(el.textContent).toBe('');
    expect(el.getAttribute('aria-live')).toBe('polite');
  });

  it('pending → saving → saved: тексты видны, кнопки «Повторить» нет', () => {
    const { rerender } = render(<SaveStatusLine status="pending" />);
    expect(screen.getByText('Изменения ещё не сохранены')).toBeTruthy();
    rerender(<SaveStatusLine status="saving" />);
    expect(screen.getByText('Сохраняю…')).toBeTruthy();
    rerender(<SaveStatusLine status="saved" savedAt={at} onRetry={() => {}} />);
    expect(screen.getByText('✓ Сохранено в 14:07')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Повторить' })).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('error — role=alert, текст «Не сохранилось», клик по «Повторить» зовёт onRetry', () => {
    const onRetry = vi.fn();
    render(<SaveStatusLine status="error" onRetry={onRetry} />);
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Не сохранилось');
    expect(alert.getAttribute('aria-live')).toBeNull(); // alert сам assertive — polite рядом противоречил бы
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('error без onRetry — текст есть, кнопки нет', () => {
    render(<SaveStatusLine status="error" />);
    expect(screen.getByRole('alert').textContent).toBe('Не сохранилось');
    expect(screen.queryByRole('button')).toBeNull();
  });

  // Находка #880: причина отказа от хука встаёт вместо общего «Не сохранилось»,
  // кнопка «Повторить» и role=alert остаются; вне ошибки errorText не виден.
  it('error с errorText — причина вместо «Не сохранилось», «Повторить» на месте', () => {
    const onRetry = vi.fn();
    render(
      <SaveStatusLine
        status="error"
        errorText="Нет связи. Проверь подключение и попробуй ещё раз."
        onRetry={onRetry}
      />,
    );
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain(
      'Нет связи. Проверь подключение и попробуй ещё раз.',
    );
    expect(alert.textContent).not.toContain('Не сохранилось');
    fireEvent.click(screen.getByRole('button', { name: 'Повторить' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('errorText при другом статусе не показывается', () => {
    render(<SaveStatusLine status="saving" errorText="Ошибка сервера" />);
    expect(screen.getByRole('status').textContent).toBe('Сохраняю…');
    expect(screen.queryByText('Ошибка сервера')).toBeNull();
  });

  it('className и align доезжают до контейнера', () => {
    render(<SaveStatusLine status="idle" className="x-save" align="right" />);
    const el = screen.getByRole('status');
    expect(el.className).toBe('x-save');
    expect(el.style.justifyContent).toBe('flex-end');
  });
});
