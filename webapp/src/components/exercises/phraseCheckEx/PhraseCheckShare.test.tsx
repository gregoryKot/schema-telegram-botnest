// @vitest-environment jsdom
// Шаринг разбора «Критик или забота?» на сайте: одна ссылка «Поделиться →» (ShareLink), выбор карточки —
// в шторке SharePickSheet, выбранная открывается в листе ShareCardSheet (шов shared → площадка).
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
  it('с переписанной фразой — одна ссылка, шторка выбора, «Краткая карточка» открывает лист «было и стало»', async () => {
    wrap('бывает, поправимо');
    expect(screen.getAllByRole('button')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Поделиться/ }));
    expect(screen.getByText('Чем поделиться?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Краткая карточка/ }));
    expect(await screen.findByText('Сохранить карточку')).toBeTruthy();
    expect(screen.getByText('Картинка уйдёт вместе со ссылкой')).toBeTruthy();
    expect(screen.queryByText('Чем поделиться?')).toBeNull();
  });

  it('«Весь разбор» в шторке открывает лист полной карточки', async () => {
    wrap('бывает, поправимо');
    fireEvent.click(screen.getByRole('button', { name: /Поделиться/ }));
    fireEvent.click(screen.getByRole('button', { name: /Весь разбор/ }));
    expect(await screen.findByText('Поделиться разбором')).toBeTruthy();
  });

  it('без переписанной фразы — шторки нет, ссылка сразу открывает лист полного разбора', () => {
    wrap();
    fireEvent.click(screen.getByRole('button', { name: /Поделиться/ }));
    expect(screen.queryByText('Чем поделиться?')).toBeNull();
    expect(screen.getByText('Поделиться разбором')).toBeTruthy();
  });
});
