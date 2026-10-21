// @vitest-environment jsdom
// Шаринг разбора «Критик или забота?» на сайте (паритет с мини-аппом, этап 3).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { mockCanvas2d } from '../../../test-support/mockCanvas2d';
import { PhraseCheckShare } from './PhraseCheckShare';

vi.mock('../../../api', () => ({ api: { trackEvent: vi.fn() } }));

mockCanvas2d();

afterEach(cleanup);

const wrap = (rewrite?: string) =>
  render(<MemoryRouter><PhraseCheckShare phrase="я всё порчу" marks={['worth']} rewrite={rewrite} /></MemoryRouter>);

describe('PhraseCheckShare', () => {
  it('с переписанной фразой — обе опции, «было и стало» открывает лист', () => {
    wrap('бывает, поправимо');
    expect(screen.getByText('Поделиться карточкой')).toBeTruthy();
    expect(screen.getByText('Поделиться всем разбором')).toBeTruthy();
    fireEvent.click(screen.getByText('Поделиться карточкой'));
    expect(screen.getByText('Картинка уйдёт вместе со ссылкой')).toBeTruthy();
  });

  it('без переписанной фразы — краткой карточки нет, полный разбор есть', () => {
    wrap();
    expect(screen.queryByText('Поделиться карточкой')).toBeNull();
    expect(screen.getByText('Поделиться всем разбором')).toBeTruthy();
  });
});
