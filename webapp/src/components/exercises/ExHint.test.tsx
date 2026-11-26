// @vitest-environment jsdom
// Подсказка упражнения — один примитив на группу (ревью g6): на компьютере раскрыта, на телефоне свёрнута
// строкой «подпись · заголовок» и не отодвигает первое поле; в письме и безопасном месте она стоит до поля.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ExHint, ExHintList, ExHintSub, ExHintText } from './ExHint';
import { LetterEx } from './LetterEx';
import { SafePlaceEx } from './SafePlaceEx';
import { MemoryRouter } from 'react-router-dom';

vi.mock('../../api', () => ({ api: { getLetters: vi.fn().mockResolvedValue([]), trackEvent: vi.fn() } }));

let phone = false;
vi.stubGlobal('matchMedia', (q: string) => ({ matches: phone && q.includes('max-width: 767px'), media: q, addEventListener() {}, removeEventListener() {} }));
afterEach(() => { phone = false; });

const hint = () => (
  <ExHint label="Совет" title="Конкретика важнее красоты">
    <ExHintText>Чем больше деталей – тем легче вернуться.</ExHintText>
    <ExHintSub>Можно</ExHintSub>
    <ExHintList items={['Реальное место']} />
  </ExHint>
);

describe('ExHint', () => {
  it('компьютер — раскрыта: подпись, заголовок и тело видны', () => {
    render(hint());
    const btn = screen.getByRole('button', { expanded: true });
    expect(btn.textContent).toContain('Совет');
    expect(btn.querySelector('.sd-why-title')!.textContent).toBe('Конкретика важнее красоты');
    expect(screen.getByText('Реальное место')).toBeTruthy();
  });

  it('телефон — свёрнута одной строкой, тап раскрывает', () => {
    phone = true;
    render(hint());
    const btn = screen.getByRole('button', { expanded: false });
    expect(screen.queryByText('Реальное место')).toBeNull();
    fireEvent.click(btn);
    expect(screen.getByText('Реальное место')).toBeTruthy();
  });

  it('письмо и безопасное место: подсказка — ExHint до поля, наклейки соломы нет', () => {
    for (const Ex of [LetterEx, SafePlaceEx]) {
      const { container, unmount } = render(<MemoryRouter><Ex onBack={() => {}} /></MemoryRouter>);
      expect(container.querySelector('.ex2-sticker')).toBeNull();
      const fold = container.querySelector('.ex2-hint')!;
      const field = container.querySelector('textarea, input')!;
      expect(fold.compareDocumentPosition(field) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      unmount();
    }
  });
});
