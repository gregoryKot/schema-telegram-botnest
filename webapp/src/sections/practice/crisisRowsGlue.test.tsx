// @vitest-environment jsdom
// Склейка строк кризисного пути (ревью g4 r5): подпись «Мне плохо» в телефонных строках рвалась «…успокоиться и /
// разобраться», цитата «мне плохо» в абзаце «Помощи рядом» — «мне / плохо». Строки клеятся при отрисовке (glue, как
// квадрат QuickSquares и copy.lead CrisisCard): слова те же, пробел после «и» и внутри короткой цитаты — неразрывный.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { PhoneHelpRows } from './PhoneHelpRows';
import { CrisisBlock } from './CrisisBlock';
import { FLASHCARD_SUB } from '../../../../shared/src/flashcard/flashcardNames';
import { byPlainText } from '../../test-support/plainText';

vi.mock('../../api', () => ({ api: { trackEvent: vi.fn() } }));
afterEach(cleanup);

describe('строки кризисного пути не рвутся на коротком слове и в цитате', () => {
  it('подпись «Мне плохо»: «и разобраться» вместе, слова прежние', () => {
    render(<PhoneHelpRows onSteps={vi.fn()} />);
    const sub = screen.getByText(byPlainText(FLASHCARD_SUB));
    expect(sub.textContent).toContain('и\u00a0разобраться');
  });

  it('«Помощь рядом»: цитата «мне плохо» одной строкой, «с близким» вместе', () => {
    render(<CrisisBlock />);
    const p = document.querySelector('.cr-text')!;
    expect(p.textContent).toContain('«мне\u00a0плохо»');
    expect(p.textContent).toContain('с\u00a0близким');
    expect(screen.getByText(byPlainText('Разговор с близким человеком тоже считается: иногда одно сообщение «мне плохо» — уже первый шаг.'))).toBe(p);
  });
});
