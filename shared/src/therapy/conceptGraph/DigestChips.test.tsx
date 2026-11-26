// @vitest-environment jsdom
// Чипы сводки «Коротко» и «Главного»: знак — только у первого чипа серии одного знака (ревью g11 r1:
// три схемы одного домена подряд с тремя одинаковыми знаками читались штампом). Порядок чипов не меняется.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DigestChips } from './DigestChips';
import type { DigestItem } from './conceptDigestModel';
import { withPaper } from './conceptPaper.test-helpers';

const tags = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('.cg-tag')).map((t) => [
    t.textContent,
    t.querySelector('[data-sign]')?.getAttribute('data-sign') ?? null,
  ]);

describe('DigestChips: знак у первого чипа серии', () => {
  it('серия одного знака — знак у первого, новая серия — снова со знаком; порядок прежний', () => {
    const items: DigestItem[] = [
      { text: 'Эмоциональная депривация', sign: 'sticks' },
      { text: 'Покинутость', sign: 'sticks' },
      { text: 'Дефективность', sign: 'sticks' },
      { text: 'Неуспешность', sign: 'leaf' },
      { text: 'Недоверие', sign: 'sticks' },
    ] as DigestItem[];
    const { container } = render(withPaper(<DigestChips items={items} />));
    expect(tags(container)).toEqual([
      ['Эмоциональная депривация', 'sticks'],
      ['Покинутость', null],
      ['Дефективность', null],
      ['Неуспешность', 'leaf'],
      ['Недоверие', 'sticks'],
    ]);
  });

  it('подпись и стрелка серию рвут: после них знак ставится заново; чипы без знака серию не образуют', () => {
    const items: DigestItem[] = [
      { text: '✗ блокированы:', plain: 'caption' },
      { text: 'Привязанность', sign: 'leaf' },
      { text: '✓ есть опора:', plain: 'caption' },
      { text: 'Привязанность', sign: 'leaf' },
      { text: '→', plain: 'arrow' },
      { text: 'Без знака' },
      { text: 'Тоже без знака' },
    ] as DigestItem[];
    const { container } = render(withPaper(<DigestChips items={items} />));
    expect(tags(container)).toEqual([
      ['Привязанность', 'leaf'],
      ['Привязанность', 'leaf'],
      ['Без знака', null],
      ['Тоже без знака', null],
    ]);
  });
});
