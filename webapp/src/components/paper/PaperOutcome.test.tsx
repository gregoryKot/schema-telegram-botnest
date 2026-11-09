// @vitest-environment jsdom
// Полноэкранный исход (редизайн 2026-11): исход → бумага и знак из OUTCOME_LOOK, полоса со знаком
// крупно — декор; один заголовок h1, лид, одна кнопка (или ссылка), тихая ссылка, код поддержки.
// Лист светлый всегда (light-lock): страница может жить вне оболочки кабинета.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { OUTCOME_LOOK } from '../../../../shared/src/theme/entityLook';
import { PaperOutcome } from './PaperOutcome';

afterEach(cleanup);

describe('PaperOutcome', () => {
  it.each(Object.keys(OUTCOME_LOOK) as (keyof typeof OUTCOME_LOOK)[])('исход %s: бумага и знак из OUTCOME_LOOK', (outcome) => {
    const { container } = render(<PaperOutcome outcome={outcome} title="Заголовок" />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toBe('light-lock pa-outcome');
    expect(root.style.getPropertyValue('--h')).toBe(String(OUTCOME_LOOK[outcome].hue));
    expect(root.querySelector('.pa-outcome-card')?.getAttribute('data-sign')).toBe(OUTCOME_LOOK[outcome].sign);
    const band = root.querySelector('.pa-outcome-band')!;
    expect(band.getAttribute('aria-hidden')).toBe('true');
    expect(band.querySelectorAll('.scn-sign > svg.pp-art').length).toBe(2);
  });

  it('«готово»: плашка Check — бумагой --surface пропом мотива, не CSS-селектором внутрь svg', () => {
    const { container } = render(<PaperOutcome outcome="done" title="Готово" />);
    const front = container.querySelector('.scn-sign > svg.pp-art:last-child rect')!;
    expect(front.getAttribute('fill')).toBe('var(--surface)');
  });

  it('надпись, h1, лид, кнопка-действие, тихая ссылка и код поддержки', () => {
    const onAction = vi.fn();
    const onLink = vi.fn();
    render(
      <PaperOutcome outcome="our_side" eyebrow="Сбой" title="Что-то пошло не так" lead="Мы уже знаем"
        action={{ label: 'Обновить', onClick: onAction }} link={{ label: 'На главную', onClick: onLink }} code="код: 7f3a" />,
    );
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Что-то пошло не так');
    expect(screen.getByText('Сбой').className).toContain('ds-eyebrow');
    expect(screen.getByText('Мы уже знаем').className).toBe('pa-outcome-lead');
    const action = screen.getByRole('button', { name: 'Обновить' });
    expect(action.className).toContain('ds-btn');
    fireEvent.click(action);
    expect(onAction).toHaveBeenCalledTimes(1);
    const link = screen.getByRole('button', { name: 'На главную' });
    expect(link.className).toContain('ds-link');
    fireEvent.click(link);
    expect(onLink).toHaveBeenCalledTimes(1);
    expect(screen.getByText('код: 7f3a').className).toBe('pa-outcome-code');
  });

  it('действие со ссылкой — <a href>, своё содержимое — между лидом и кнопкой; свой вид вместо исхода', () => {
    const { container } = render(
      <PaperOutcome outcome={{ hue: 240, sign: 'limits' }} title="Вход защищён" action={{ label: 'Войти', href: '/login' }}>
        <input aria-label="Код" />
      </PaperOutcome>,
    );
    expect((container.firstElementChild as HTMLElement).style.getPropertyValue('--h')).toBe('240');
    const link = screen.getByRole('link', { name: 'Войти' });
    expect(link.getAttribute('href')).toBe('/login');
    const body = container.querySelector('.pa-outcome-body')!;
    const kids = [...body.children];
    expect(kids.indexOf(screen.getByLabelText('Код'))).toBeLessThan(kids.indexOf(link));
  });
});
