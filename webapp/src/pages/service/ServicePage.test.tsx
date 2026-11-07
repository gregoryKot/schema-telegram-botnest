// @vitest-environment jsdom
// Оболочка служебных страниц входа (подтверждение, ошибка входа, привязка устройства):
// знак «Всё по схеме» сверху ведёт на главную сайта (владелец 2026-11-07: «логотип
// должен кидать на главную»), содержимое страницы — под ним.
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ServicePage } from './ServicePage';

describe('ServicePage', () => {
  it('знак — ссылка на главную, содержимое страницы на месте', () => {
    render(<ServicePage><p>Ссылка устарела</p></ServicePage>);
    const home = screen.getByRole('link', { name: 'На главную' });
    expect(home.getAttribute('href')).toBe('/');
    expect(home.querySelector('svg[data-brand-mark]')).toBeTruthy();
    expect(screen.getByText('Ссылка устарела')).toBeTruthy();
  });
});
