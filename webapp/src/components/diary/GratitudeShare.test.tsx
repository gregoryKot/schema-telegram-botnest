// @vitest-environment jsdom
// Шаринг записи благодарности на сайте (паритет с мини-аппом, этап 3).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mockCanvas2d } from '../../test-support/mockCanvas2d';
import { GratitudeShare } from './GratitudeShare';

const track = vi.hoisted(() => vi.fn());
vi.mock('../../api', () => ({ api: { trackEvent: track } }));

mockCanvas2d();

afterEach(cleanup);

const wrap = (items: string[]) =>
  render(<MemoryRouter><GratitudeShare items={items} dateLabel="1 августа" /></MemoryRouter>);

describe('GratitudeShare', () => {
  it('пустая запись — ничего не рендерит', () => {
    const { container } = wrap([]);
    expect(container.textContent).toBe('');
  });

  it('тап открывает лист шаринга, закрыт по умолчанию', () => {
    wrap(['Тёплый чай']);
    expect(screen.queryByText('Картинка уйдёт вместе со ссылкой')).toBeNull();
    fireEvent.click(screen.getByText('Поделиться благодарностью'));
    expect(screen.getByText('Картинка уйдёт вместе со ссылкой')).toBeTruthy();
  });
});
