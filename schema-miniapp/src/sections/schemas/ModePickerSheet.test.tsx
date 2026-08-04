// @vitest-environment jsdom
// ModePickerSheet — выбор своих режимов (0% покрытия): предзаполнение из
// уже сохранённого выбора, тап переключает режим (toggle, не только
// добавление), клик по «Сохранить» отдаёт РЕАЛЬНО накопленный список — не
// исходный selected и не пустой массив (частый баг с «протухшим» замыканием).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ModePickerSheet } from './ModePickerSheet';

afterEach(cleanup);

describe('ModePickerSheet — предзаполнение выбора', () => {
  it('уже выбранный режим отмечен галочкой при открытии', () => {
    render(
      <ModePickerSheet
        selected={['vulnerable_child']}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    // Галочка ✓ стоит рядом именно с уязвимым ребёнком, а не с произвольным.
    const row = screen.getByText('Уязвимый Ребёнок').closest('[role="button"]');
    expect(row?.textContent).toContain('✓');
  });

  it('кнопка «Сохранить» сразу показывает число уже выбранных режимов', () => {
    render(
      <ModePickerSheet
        selected={['vulnerable_child', 'demanding_critic']}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Сохранить (2)')).toBeTruthy();
  });

  it('без выбранных режимов кнопка без числа', () => {
    render(
      <ModePickerSheet selected={[]} onSave={() => {}} onClose={() => {}} />,
    );
    expect(screen.getByText('Сохранить')).toBeTruthy();
  });
});

describe('ModePickerSheet — переключение режимов (toggle)', () => {
  it('тап по невыбранному режиму добавляет его в счётчик', () => {
    render(
      <ModePickerSheet selected={[]} onSave={() => {}} onClose={() => {}} />,
    );
    fireEvent.click(screen.getByText('Требовательный Критик'));
    expect(screen.getByText('Сохранить (1)')).toBeTruthy();
  });

  it('повторный тап по уже выбранному режиму убирает его (настоящий toggle)', () => {
    render(
      <ModePickerSheet
        selected={['demanding_critic']}
        onSave={() => {}}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('Сохранить (1)')).toBeTruthy();
    fireEvent.click(screen.getByText('Требовательный Критик'));
    expect(screen.getByText('Сохранить')).toBeTruthy();
    expect(screen.queryByText(/Сохранить \(/)).toBeNull();
  });
});

describe('ModePickerSheet — сохранение (read-after-write в рамках сессии выбора)', () => {
  it('onSave получает реально накопленный список выбора, а не исходный selected', () => {
    const onSave = vi.fn();
    const onClose = vi.fn();
    render(
      <ModePickerSheet
        selected={['demanding_critic']}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('Уязвимый Ребёнок'));
    fireEvent.click(screen.getByText(/Сохранить/));

    expect(onSave).toHaveBeenCalledWith(
      expect.arrayContaining(['demanding_critic', 'vulnerable_child']),
    );
    expect(onSave.mock.calls[0][0]).toHaveLength(2);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('ModePickerSheet — полный каталог доступен, не только популярные', () => {
  it('режим не из «С чего начать» тоже переключается и попадает в результат', () => {
    const onSave = vi.fn();
    render(
      <ModePickerSheet selected={[]} onSave={onSave} onClose={() => {}} />,
    );
    // "Счастливый Ребёнок" не входит в POPULAR_MODE_IDS — проверяем секцию
    // «Все режимы» тоже реально работает, не только быстрый список.
    fireEvent.click(screen.getByText('Счастливый Ребёнок'));
    fireEvent.click(screen.getByText(/Сохранить/));
    expect(onSave).toHaveBeenCalledWith(['happy_child']);
  });
});
