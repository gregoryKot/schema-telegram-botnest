// @vitest-environment jsdom
// BeliefDoneScreen — итоговая сводка проверки убеждения. Read-after-write:
// проверяем, что убеждение и списки за/против, накопленные в предыдущих
// шагах, реально видны на итоговом экране, а не теряются при сборке сводки.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { BeliefDoneScreen } from './DoneScreen';

afterEach(() => {
  cleanup();
});

describe('BeliefDoneScreen', () => {
  it('показывает убеждение и оба списка доказательств', () => {
    render(
      <BeliefDoneScreen
        belief="я всегда всё порчу"
        forList={['опоздал вчера']}
        againstList={['вовремя закончил проект']}
        reframe="иногда ошибаюсь, но не всегда"
        onClose={() => {}}
      />,
    );
    expect(screen.getByText('«я всегда всё порчу»')).toBeTruthy();
    expect(screen.getByText('ЗА (1)')).toBeTruthy();
    expect(screen.getByText('• опоздал вчера')).toBeTruthy();
    expect(screen.getByText('ПРОТИВ (1)')).toBeTruthy();
    expect(screen.getByText('• вовремя закончил проект')).toBeTruthy();
    expect(screen.getByText('иногда ошибаюсь, но не всегда')).toBeTruthy();
  });

  it('без доказательств и переформулировки не показывает пустые секции', () => {
    render(
      <BeliefDoneScreen
        belief="я недостаточно хорош"
        forList={[]}
        againstList={[]}
        reframe=""
        onClose={() => {}}
      />,
    );
    expect(screen.queryByText(/^ЗА/)).toBeNull();
    expect(screen.queryByText(/^ПРОТИВ/)).toBeNull();
    expect(screen.queryByText('ПЕРЕФОРМУЛИРОВКА')).toBeNull();
  });

  it('кнопка «Готово» вызывает onClose', () => {
    const onClose = vi.fn();
    render(
      <BeliefDoneScreen
        belief="тест"
        forList={[]}
        againstList={[]}
        reframe=""
        onClose={onClose}
      />,
    );
    fireEvent.click(screen.getByText('Готово'));
    expect(onClose).toHaveBeenCalled();
  });
});
